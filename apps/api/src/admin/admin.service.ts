import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Match as MatchRow } from '@prisma/client';
import {
  MATCH_STATUS_TRANSITIONS,
  PROJECT_STATUS_TRANSITIONS,
  isValidTransition,
  resolveStaffPermissions,
  type AdminClient,
  type AdminQueues,
  type AdminQueueProject,
  type AdminSurveyor,
  type Match,
  type MatchStatus,
  type ProjectDetail,
  type ProjectStatus,
  type StaffAdmin,
  type StaffLevel,
  type StaffPermission,
  type StaffPermissionPreset,
  type SurveyService,
  type UserStatus,
} from '@surveylink/types';
import type {
  AdminSurveyorQuery,
  CreateMatchInput,
  CreateStaffAdminInput,
  UpdateMatchInput,
  UpdateProjectStatusInput,
  UpdateStaffAdminInput,
} from '@surveylink/validation';
import { normalizeEmail } from '@surveylink/validation';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectsService } from '../projects/projects.service';
import { IDENTITY_PROVIDER, type IdentityProvider } from '../auth/identity/identity-provider';
import {
  AUTH_PROVIDER_NAME,
} from '../auth/identity/auth0.identity-provider';
import {
  rememberDevSignup,
  devAuthEnabled,
  devSubjectForEmail,
} from '../auth/dev-auth';
import { ensureMembership } from '../auth/memberships';
import { StaffContextService } from '../auth/staff-context.service';

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
    private readonly config: ConfigService,
    private readonly staffContext: StaffContextService,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
  ) {}

  /**
   * Aggregate counts only — no row-level data. Keeping this permission-free
   * lets every staff member see a snapshot on the overview page, while the
   * actual client/surveyor/project rows only surface in their dedicated,
   * permission-gated modules.
   */
  async getQueues(): Promise<AdminQueues> {
    const [userCount, surveyorCount, openCount] = await Promise.all([
      this.prisma.userRole.count({ where: { role: 'client' } }),
      this.prisma.surveyorProfile.count(),
      this.prisma.project.count({ where: { status: { in: OPEN_PROJECT_STATUSES } } }),
    ]);

    return {
      counts: { users: userCount, surveyors: surveyorCount, openProjects: openCount },
    };
  }

  async listClients(): Promise<AdminClient[]> {
    const rows = await this.prisma.user.findMany({
      where: { roles: { some: { role: 'client' } } },
      orderBy: { createdAt: 'desc' },
      include: {
        accountProfile: { select: { companyName: true } },
        _count: { select: { projects: true } },
      },
    });
    return rows.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      companyName: u.accountProfile?.companyName ?? null,
      emailVerified: u.emailVerified,
      phoneVerified: u.phoneVerified,
      projectCount: u._count.projects,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async listOpenProjects(): Promise<AdminQueueProject[]> {
    const openProjects = await this.prisma.project.findMany({
      where: { status: { in: OPEN_PROJECT_STATUSES } },
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { fullName: true } } },
    });
    return openProjects.map((p) => ({
      id: p.id,
      title: p.title,
      clientName: p.client.fullName,
      services: (p.services as unknown as SurveyService[]) ?? [],
      locationText: p.locationText,
      status: p.status as ProjectStatus,
      createdAt: p.createdAt.toISOString(),
    }));
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
      projectId: project.id,
      matchId: match.id,
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

  async listStaffAdmins(): Promise<StaffAdmin[]> {
    const rows = await this.prisma.adminProfile.findMany({
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    });
    return rows.map((row) => this.toStaffAdminDto(row));
  }

  async createStaffAdmin(
    actorSubject: string,
    input: CreateStaffAdminInput,
  ): Promise<StaffAdmin> {
    await this.requireSuperAdmin(actorSubject);

    const email = normalizeEmail(input.email);
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: { equals: email, mode: 'insensitive' } }, { phone: input.phone }],
      },
    });
    if (existing) {
      const memberships = await this.prisma.userRole.findMany({
        where: { userId: existing.id },
        select: { role: true },
      });
      if (memberships.some((m) => m.role === 'admin')) {
        throw new ConflictException('That account already has staff access');
      }
      throw new ConflictException(
        'An account with this email or phone already exists. Use a dedicated staff email.',
      );
    }

    const preset = input.permissionPreset;
    const permissions =
      preset === 'custom'
        ? input.permissions
        : resolveStaffPermissions({
            staffLevel: 'admin',
            permissionPreset: preset,
            permissions: input.permissions,
          });

    let user;
    if (devAuthEnabled(this.config)) {
      const subject = devSubjectForEmail(email);
      rememberDevSignup(email, input.password, subject);
      user = await this.prisma.user.create({
        data: {
          fullName: input.fullName,
          email,
          phone: input.phone,
          emailVerified: true,
          phoneVerified: true,
          authProvider: 'dev',
          authSubject: subject,
          roleHint: 'client',
        },
      });
    } else {
      const identity = await this.identity.createIdentity({
        fullName: input.fullName,
        email,
        phone: input.phone,
        password: input.password,
      });
      user = await this.prisma.user.create({
        data: {
          fullName: input.fullName,
          email,
          phone: input.phone,
          emailVerified: identity.emailVerified,
          authProvider: AUTH_PROVIDER_NAME,
          authSubject: identity.subject,
          roleHint: 'client',
        },
      });
    }

    await ensureMembership(this.prisma, user.id, 'admin');
    const profile = await this.prisma.adminProfile.update({
      where: { userId: user.id },
      data: {
        staffLevel: 'admin',
        permissionPreset: preset,
        permissions: permissions as unknown as Prisma.InputJsonValue,
        title: input.title ?? null,
      },
      include: { user: true },
    });
    return this.toStaffAdminDto(profile);
  }

  async updateStaffAdmin(
    actorSubject: string,
    staffUserId: string,
    input: UpdateStaffAdminInput,
  ): Promise<StaffAdmin> {
    await this.requireSuperAdmin(actorSubject);

    const profile = await this.prisma.adminProfile.findUnique({
      where: { userId: staffUserId },
      include: { user: true },
    });
    if (!profile) throw new NotFoundException('Staff admin not found');
    if (profile.staffLevel === 'super_admin') {
      throw new ForbiddenException('Cannot edit the super admin from this screen');
    }

    const nextPreset = (input.permissionPreset ??
      profile.permissionPreset) as StaffPermissionPreset;
    let nextPermissions = Array.isArray(profile.permissions)
      ? (profile.permissions as StaffPermission[])
      : [];
    if (input.permissions) nextPermissions = input.permissions;
    if (nextPreset !== 'custom') {
      nextPermissions = resolveStaffPermissions({
        staffLevel: 'admin',
        permissionPreset: nextPreset,
        permissions: nextPermissions,
      });
    }

    if (input.status) {
      await this.prisma.user.update({
        where: { id: staffUserId },
        data: { status: input.status },
      });
    }

    const updated = await this.prisma.adminProfile.update({
      where: { userId: staffUserId },
      data: {
        title: input.title === undefined ? undefined : input.title,
        permissionPreset: nextPreset,
        permissions: nextPermissions as unknown as Prisma.InputJsonValue,
      },
      include: { user: true },
    });
    return this.toStaffAdminDto(updated);
  }

  async removeStaffAdmin(actorSubject: string, staffUserId: string): Promise<void> {
    await this.requireSuperAdmin(actorSubject);
    const profile = await this.prisma.adminProfile.findUnique({
      where: { userId: staffUserId },
    });
    if (!profile) throw new NotFoundException('Staff admin not found');
    if (profile.staffLevel === 'super_admin') {
      throw new ForbiddenException('Cannot remove the super admin');
    }

    await this.prisma.$transaction([
      this.prisma.adminProfile.delete({ where: { userId: staffUserId } }),
      this.prisma.userRole.deleteMany({ where: { userId: staffUserId, role: 'admin' } }),
    ]);
  }

  private async requireSuperAdmin(subject: string): Promise<void> {
    const ctx = await this.staffContext.getBySubject(subject);
    if (!ctx || ctx.staffLevel !== 'super_admin') {
      throw new ForbiddenException('Super admin access required');
    }
  }

  private toStaffAdminDto(row: {
    userId: string;
    title: string | null;
    staffLevel: string;
    permissionPreset: string;
    permissions: unknown;
    createdAt: Date;
    user: {
      fullName: string;
      email: string;
      phone: string;
      status: string;
    };
  }): StaffAdmin {
    const staffLevel = row.staffLevel as StaffLevel;
    const permissionPreset = row.permissionPreset as StaffPermissionPreset;
    const stored = Array.isArray(row.permissions)
      ? (row.permissions as StaffPermission[])
      : [];
    return {
      id: row.userId,
      fullName: row.user.fullName,
      email: row.user.email,
      phone: row.user.phone,
      status: row.user.status as UserStatus,
      staffLevel,
      permissionPreset,
      permissions: resolveStaffPermissions({
        staffLevel,
        permissionPreset,
        permissions: stored,
      }),
      title: row.title,
      createdAt: row.createdAt.toISOString(),
    };
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
