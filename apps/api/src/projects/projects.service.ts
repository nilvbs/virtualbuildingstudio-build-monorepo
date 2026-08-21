import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Project as ProjectRow, type User } from '@prisma/client';
import type {
  AppRole,
  ClientSurveyorPage,
  ClientSurveyorSort,
  ClientSurveyorSummary,
  Project,
  ProjectDetail,
  ProjectMatchInfo,
  ProjectStatus,
  SurveyService,
} from '@surveylink/types';
import { normalizeProjectDetails } from '@surveylink/types';
import type { ClientSurveyorBrowseInput, CreateProjectInput } from '@surveylink/validation';
import { PrismaService } from '../prisma/prisma.service';
import { S3MediaStorageService } from '../media/s3-media.storage';
import { haversineKm } from '../common/geo';

interface GeoRow {
  id: string;
  lng: number | null;
  lat: number | null;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: S3MediaStorageService,
  ) {}

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
        details: (input.details ?? {}) as Prisma.InputJsonValue,
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

  /**
   * Browse matchable surveyors for a client project with default relevance
   * (service overlap + proximity) and advanced filters + cursor pagination.
   */
  async browseSurveyors(
    subject: string,
    projectId: string,
    query: ClientSurveyorBrowseInput,
  ): Promise<ClientSurveyorPage> {
    const user = await this.requireUser(subject);
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.clientId !== user.id) {
      throw new NotFoundException('Project not found');
    }

    const projectServices = (project.services as unknown as SurveyService[]) ?? [];
    const filterServices = query.services?.length ? query.services : projectServices;

    const projectGeo = await this.prisma.$queryRaw<GeoRow[]>`
      SELECT id::text AS id, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
      FROM projects WHERE id = ${projectId}::uuid`;
    const projectPoint = this.pointOf(projectGeo[0]);

    const rows = await this.prisma.surveyorProfile.findMany({
      where: {
        isMatchable: true,
        ...(query.bldVerified === true ? { bldVerified: true } : {}),
        ...(query.minRating != null ? { ratingAvg: { gte: query.minRating } } : {}),
        ...(query.minDayRateCents != null || query.maxDayRateCents != null
          ? {
              dayRateCents: {
                ...(query.minDayRateCents != null ? { gte: BigInt(query.minDayRateCents) } : {}),
                ...(query.maxDayRateCents != null ? { lte: BigInt(query.maxDayRateCents) } : {}),
              },
            }
          : {}),
      },
      include: {
        user: {
          select: {
            fullName: true,
            avatarKey: true,
            emailVerified: true,
            phoneVerified: true,
          },
        },
      },
    });

    const surveyorIds = rows.map((r) => r.id);
    const geo =
      surveyorIds.length === 0
        ? []
        : await this.prisma.$queryRawUnsafe<GeoRow[]>(
            `SELECT id::text AS id, ST_X(base_location::geometry) AS lng, ST_Y(base_location::geometry) AS lat
             FROM surveyor_profiles
             WHERE id = ANY($1::uuid[])`,
            surveyorIds,
          );
    const geoById = new Map(geo.map((g) => [g.id, g]));

    const radiusKm = query.radiusKm ?? (projectPoint ? 100 : undefined);
    const qNorm = query.q?.trim().toLowerCase();

    let items: ClientSurveyorSummary[] = rows.map((s) => {
      const services = (s.services as unknown as SurveyService[]) ?? [];
      const g = geoById.get(s.id);
      const location =
        g && g.lng != null && g.lat != null ? { lng: Number(g.lng), lat: Number(g.lat) } : null;
      const distanceKm =
        projectPoint && location ? Math.round(haversineKm(projectPoint, location) * 10) / 10 : null;

      const overlap = filterServices.length
        ? filterServices.filter((svc) => services.includes(svc)).length
        : 0;
      const overlapRatio = filterServices.length ? overlap / filterServices.length : 0;

      const bldVerified = s.bldVerified || (s.user.emailVerified && s.user.phoneVerified);
      const ratingAvg = s.ratingAvg != null ? Number(s.ratingAvg) : null;

      let relevanceScore = Math.round(overlapRatio * 45);
      if (distanceKm != null && radiusKm) {
        const proximity = Math.max(0, 1 - distanceKm / radiusKm);
        relevanceScore += Math.round(proximity * 35);
      } else if (distanceKm == null) {
        relevanceScore += 5;
      }
      if (bldVerified) relevanceScore += 12;
      if (ratingAvg != null) relevanceScore += Math.round((ratingAvg / 5) * 8);

      return {
        profileId: s.id,
        fullName: s.user.fullName,
        avatarUrl: this.media.resolveSignedUrl(s.user.avatarKey),
        bio: s.bio,
        baseCity: s.baseCity,
        services,
        equipment: (s.equipment as unknown as string[]) ?? [],
        radiusKm: s.radiusKm,
        dayRateCents: s.dayRateCents != null ? Number(s.dayRateCents) : null,
        ratingAvg,
        ratingCount: s.ratingCount,
        bldVerified,
        distanceKm,
        relevanceScore,
      };
    });

    if (filterServices.length > 0) {
      items = items.filter((s) => s.services.some((svc) => filterServices.includes(svc)));
    }

    if (radiusKm != null && projectPoint) {
      items = items.filter((s) => s.distanceKm == null || s.distanceKm <= radiusKm);
    }

    if (qNorm) {
      items = items.filter(
        (s) =>
          s.fullName.toLowerCase().includes(qNorm) ||
          (s.baseCity?.toLowerCase().includes(qNorm) ?? false) ||
          (s.bio?.toLowerCase().includes(qNorm) ?? false),
      );
    }

    if (query.bldVerified === true) {
      items = items.filter((s) => s.bldVerified);
    }

    items = this.sortSurveyors(items, query.sort ?? 'relevance');

    const total = items.length;
    const cursor = query.cursor ?? 0;
    const limit = query.limit ?? 12;
    const page = items.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < total ? String(cursor + limit) : null;

    return { items: page, nextCursor, total };
  }

  private sortSurveyors(
    items: ClientSurveyorSummary[],
    sort: ClientSurveyorSort,
  ): ClientSurveyorSummary[] {
    const copy = [...items];
    switch (sort) {
      case 'distance':
        return copy.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      case 'rating':
        return copy.sort((a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1));
      case 'price_asc':
        return copy.sort((a, b) => (a.dayRateCents ?? Infinity) - (b.dayRateCents ?? Infinity));
      case 'price_desc':
        return copy.sort((a, b) => (b.dayRateCents ?? -1) - (a.dayRateCents ?? -1));
      case 'relevance':
      default:
        return copy.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
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
      details: normalizeProjectDetails((row as { details?: unknown }).details ?? {}),
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
