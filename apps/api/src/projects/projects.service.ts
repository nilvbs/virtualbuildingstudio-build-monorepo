import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Project as ProjectRow, type User } from '@prisma/client';
import type {
  AppRole,
  Project,
  ProjectDetail,
  ProjectMatchInfo,
  ProjectStatus,
  SurveyService,
} from '@surveylink/types';
import type { CreateProjectInput } from '@surveylink/validation';
import { PrismaService } from '../prisma/prisma.service';

interface GeoRow {
  id: string;
  lng: number | null;
  lat: number | null;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(subject: string, input: CreateProjectInput): Promise<Project> {
    const user = await this.requireUser(subject);

    const row = await this.prisma.project.create({
      data: {
        clientId: user.id,
        title: input.title,
        services: input.services as Prisma.InputJsonValue,
        locationText: input.locationText ?? null,
        buildingType: input.buildingType ?? null,
        buildingAge: input.buildingAge ?? null,
        floors: input.floors ?? null,
        areaSqft: input.areaSqft ?? null,
        neededWithin: input.neededWithin ?? null,
        notes: input.notes ?? null,
      },
    });

    if (input.location) {
      await this.prisma.$executeRaw`
        UPDATE projects
        SET location = ST_SetSRID(ST_MakePoint(${input.location.lng}::double precision, ${input.location.lat}::double precision), 4326)::geography,
            updated_at = now()
        WHERE id = ${row.id}::uuid`;
    }

    return this.getOwned(user.id, row.id);
  }

  async listForClient(subject: string): Promise<Project[]> {
    const user = await this.requireUser(subject);
    const rows = await this.prisma.project.findMany({
      where: { clientId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    const geo = await this.prisma.$queryRaw<GeoRow[]>`
      SELECT id::text AS id, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
      FROM projects WHERE client_id = ${user.id}::uuid`;
    const geoById = new Map(geo.map((g) => [g.id, g]));
    return rows.map((r) => this.toDto(r, this.pointOf(geoById.get(r.id))));
  }

  async getById(subject: string, roles: AppRole[], projectId: string): Promise<ProjectDetail> {
    const user = await this.requireUser(subject);
    const row = await this.prisma.project.findUnique({ where: { id: projectId } });
    // Hide existence from non-owners (admins may view any).
    if (!row || (row.clientId !== user.id && !roles.includes('admin'))) {
      throw new NotFoundException('Project not found');
    }

    const geo = await this.prisma.$queryRaw<GeoRow[]>`
      SELECT id::text AS id, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
      FROM projects WHERE id = ${projectId}::uuid`;

    const matches = await this.prisma.match.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { surveyor: { select: { baseCity: true } } },
    });

    const matchInfo: ProjectMatchInfo[] = matches.map((m) => ({
      matchId: m.id,
      status: m.status as ProjectMatchInfo['status'],
      surveyorBaseCity: m.surveyor.baseCity,
      createdAt: m.createdAt.toISOString(),
    }));

    return { ...this.toDto(row, this.pointOf(geo[0])), matches: matchInfo };
  }

  private async getOwned(userId: string, projectId: string): Promise<Project> {
    const row = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!row || row.clientId !== userId) {
      throw new NotFoundException('Project not found');
    }
    const geo = await this.prisma.$queryRaw<GeoRow[]>`
      SELECT id::text AS id, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
      FROM projects WHERE id = ${projectId}::uuid`;
    return this.toDto(row, this.pointOf(geo[0]));
  }

  private pointOf(geo: GeoRow | undefined): { lng: number; lat: number } | null {
    if (geo && geo.lng != null && geo.lat != null) {
      return { lng: Number(geo.lng), lat: Number(geo.lat) };
    }
    return null;
  }

  private toDto(row: ProjectRow, location: { lng: number; lat: number } | null): Project {
    return {
      id: row.id,
      clientId: row.clientId,
      title: row.title,
      services: (row.services as unknown as SurveyService[]) ?? [],
      location,
      locationText: row.locationText,
      buildingType: row.buildingType,
      buildingAge: row.buildingAge,
      floors: row.floors,
      areaSqft: row.areaSqft,
      neededWithin: row.neededWithin,
      notes: row.notes,
      status: row.status as ProjectStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async requireUser(subject: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { authSubject: subject } });
    if (!user) {
      throw new NotFoundException('No local account is linked to this identity');
    }
    return user;
  }
}
