import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Match as MatchRow } from '@prisma/client';
import {
  MATCH_STATUS_TRANSITIONS,
  PROJECT_STATUS_TRANSITIONS,
  isValidTransition,
  type AdminQueues,
  type AdminSurveyor,
  type Match,
  type MatchStatus,
  type ProjectDetail,
  type ProjectStatus,
  type RoleHint,
  type SurveyService,
} from '@surveylink/types';
import type {
  AdminSurveyorQuery,
  CreateMatchInput,
  UpdateMatchInput,
  UpdateProjectStatusInput,
} from '@surveylink/validation';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectsService } from '../projects/projects.service';

interface GeoRow {
  id: string;
  lng: number | null;
  lat: number | null;
}

const OPEN_PROJECT_STATUSES: ProjectStatus[] = ['submitted', 'matching'];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly projects: ProjectsService,
  ) {}

  async getQueues(): Promise<AdminQueues> {
    const [userCount, surveyorCount, openCount, recentUsers, recentSurveyors, openProjects] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.surveyorProfile.count(),
        this.prisma.project.count({ where: { status: { in: OPEN_PROJECT_STATUSES } } }),
        this.prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
        this.prisma.surveyorProfile.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { fullName: true } } },
        }),
        this.prisma.project.findMany({
          where: { status: { in: OPEN_PROJECT_STATUSES } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { client: { select: { fullName: true } } },
        }),
      ]);

    return {
      counts: { users: userCount, surveyors: surveyorCount, openProjects: openCount },
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        roleHint: u.roleHint as RoleHint,
        emailVerified: u.emailVerified,
        phoneVerified: u.phoneVerified,
        createdAt: u.createdAt.toISOString(),
      })),
      recentSurveyors: recentSurveyors.map((s) => ({
        profileId: s.id,
        userId: s.userId,
        fullName: s.user.fullName,
        baseCity: s.baseCity,
        services: (s.services as unknown as SurveyService[]) ?? [],
        radiusKm: s.radiusKm,
        isMatchable: s.isMatchable,
        createdAt: s.createdAt.toISOString(),
      })),
      openProjects: openProjects.map((p) => ({
        id: p.id,
        title: p.title,
        clientName: p.client.fullName,
        services: (p.services as unknown as SurveyService[]) ?? [],
        locationText: p.locationText,
        status: p.status as ProjectStatus,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  async browseSurveyors(query: AdminSurveyorQuery): Promise<AdminSurveyor[]> {
    const where: Prisma.SurveyorProfileWhereInput = {};
    if (query.service) {
      where.services = { array_contains: query.service };
    }

    const rows = await this.prisma.surveyorProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { fullName: true, email: true, phone: true } } },
    });

    const geo = await this.prisma.$queryRaw<GeoRow[]>`
      SELECT id::text AS id, ST_X(base_location::geometry) AS lng, ST_Y(base_location::geometry) AS lat
      FROM surveyor_profiles`;
    const geoById = new Map(geo.map((g) => [g.id, g]));

    const near =
      query.nearLat != null && query.nearLng != null
        ? { lat: query.nearLat, lng: query.nearLng }
        : null;

    let result: AdminSurveyor[] = rows.map((s) => {
      const g = geoById.get(s.id);
      const location =
        g && g.lng != null && g.lat != null ? { lng: Number(g.lng), lat: Number(g.lat) } : null;
      const distanceKm = near && location ? haversineKm(near, location) : null;
      return {
        profileId: s.id,
        userId: s.userId,
        fullName: s.user.fullName,
        email: s.user.email,
        phone: s.user.phone,
        baseCity: s.baseCity,
        services: (s.services as unknown as SurveyService[]) ?? [],
        equipment: (s.equipment as unknown as string[]) ?? [],
        radiusKm: s.radiusKm,
        dayRateCents: s.dayRateCents != null ? Number(s.dayRateCents) : null,
        isMatchable: s.isMatchable,
        location,
        distanceKm,
        createdAt: s.createdAt.toISOString(),
      };
    });

    if (near) {
      const radius = query.radiusKm ?? 100;
      result = result
        .filter((s) => s.distanceKm != null && s.distanceKm <= radius)
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }

    return result;
  }

  async createMatch(adminSubject: string, input: CreateMatchInput): Promise<Match> {
    const adminUserId = await this.requireUserId(adminSubject);

    const project = await this.prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (!OPEN_PROJECT_STATUSES.includes(project.status as ProjectStatus)) {
      throw new ConflictException(`Project is not open for matching (status: ${project.status})`);
    }

    const surveyor = await this.prisma.surveyorProfile.findUnique({
      where: { id: input.surveyorId },
      select: { id: true, userId: true },
    });
    if (!surveyor) throw new NotFoundException('Surveyor profile not found');

    // Match creation + project advance are atomic; notifications fire after.
    const [match] = await this.prisma.$transaction([
      this.prisma.match.create({
        data: {
          projectId: input.projectId,
          surveyorId: input.surveyorId,
          matchedBy: adminUserId,
          status: 'proposed',
          adminNotes: input.notes ?? null,
        },
      }),
      this.prisma.project.update({
        where: { id: input.projectId },
        data: { status: 'matched' },
      }),
    ]);

    await this.notifications.notifyMatchCreated({
      clientUserId: project.clientId,
      surveyorUserId: surveyor.userId,
      projectTitle: project.title,
    });

    return this.toMatchDto(match);
  }

  async updateMatch(id: string, input: UpdateMatchInput): Promise<Match> {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException('Match not found');

    const data: Prisma.MatchUpdateInput = {};
    if (input.status !== undefined) {
      if (!isValidTransition(MATCH_STATUS_TRANSITIONS, match.status as MatchStatus, input.status)) {
        throw new BadRequestException(
          `Cannot move match from ${match.status} to ${input.status}`,
        );
      }
      data.status = input.status;
    }
    if (input.adminNotes !== undefined) data.adminNotes = input.adminNotes;

    const updated = await this.prisma.match.update({ where: { id }, data });
    return this.toMatchDto(updated);
  }

  async updateProjectStatus(
    adminSubject: string,
    roles: ('admin')[],
    id: string,
    input: UpdateProjectStatusInput,
  ): Promise<ProjectDetail> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');

    if (
      !isValidTransition(PROJECT_STATUS_TRANSITIONS, project.status as ProjectStatus, input.status)
    ) {
      throw new BadRequestException(
        `Cannot move project from ${project.status} to ${input.status}`,
      );
    }

    await this.prisma.project.update({ where: { id }, data: { status: input.status } });
    return this.projects.getById(adminSubject, roles, id);
  }

  private async requireUserId(subject: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: subject },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('No local account is linked to this admin identity');
    return user.id;
  }

  private toMatchDto(row: MatchRow): Match {
    return {
      id: row.id,
      projectId: row.projectId,
      surveyorId: row.surveyorId,
      matchedBy: row.matchedBy,
      status: row.status as MatchStatus,
      adminNotes: row.adminNotes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
