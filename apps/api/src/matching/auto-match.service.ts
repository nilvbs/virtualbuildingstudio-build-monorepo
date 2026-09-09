import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SurveyService } from '@surveylink/types';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { haversineKm } from '../common/geo';
import {
  DEFAULT_WORKING_HOURS,
  addWorkingHours,
  type WorkingHoursConfig,
} from './working-hours';

interface GeoRow {
  id: string;
  lng: number | null;
  lat: number | null;
}

type Candidate = {
  profileId: string;
  userId: string;
  distanceKm: number | null;
  score: number;
};

/**
 * Uber-style auto-match: when a client posts a project, fan out proposed offers
 * to nearby live surveyors with a working-hours response deadline.
 */
@Injectable()
export class AutoMatchService {
  private readonly logger = new Logger(AutoMatchService.name);
  private readonly maxOffers: number;
  private readonly responseWorkingHours: number;
  private readonly workingHours: WorkingHoursConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {
    this.maxOffers = Number(this.config.get('AUTO_MATCH_MAX_OFFERS') ?? 8);
    this.responseWorkingHours = Number(this.config.get('AUTO_MATCH_RESPONSE_HOURS') ?? 3);
    this.workingHours = {
      ...DEFAULT_WORKING_HOURS,
      timeZone: this.config.get('AUTO_MATCH_TZ') ?? DEFAULT_WORKING_HOURS.timeZone,
      startHour: Number(this.config.get('AUTO_MATCH_WORK_START') ?? DEFAULT_WORKING_HOURS.startHour),
      endHour: Number(this.config.get('AUTO_MATCH_WORK_END') ?? DEFAULT_WORKING_HOURS.endHour),
    };
  }

  /** Run after a client creates a project. Best-effort — never fails the create. */
  async offerForProject(projectId: string): Promise<number> {
    try {
      return await this.runOffer(projectId);
    } catch (err) {
      this.logger.error(
        `Auto-match failed for project ${projectId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return 0;
    }
  }

  private async runOffer(projectId: string): Promise<number> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return 0;
    if (!['submitted', 'matching'].includes(project.status)) return 0;

    const existing = await this.prisma.match.count({
      where: { projectId, status: 'proposed' },
    });
    if (existing > 0) return 0;

    const projectServices = (project.services as unknown as SurveyService[]) ?? [];
    if (projectServices.length === 0) return 0;

    const projectGeo = await this.prisma.$queryRaw<GeoRow[]>`
      SELECT id::text AS id, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
      FROM projects WHERE id = ${projectId}::uuid`;
    const projectPoint =
      projectGeo[0]?.lng != null && projectGeo[0]?.lat != null
        ? { lng: Number(projectGeo[0].lng), lat: Number(projectGeo[0].lat) }
        : null;

    const rows = await this.prisma.surveyorProfile.findMany({
      where: { isMatchable: true },
      select: {
        id: true,
        userId: true,
        services: true,
        radiusKm: true,
        bldVerified: true,
        ratingAvg: true,
      },
    });

    if (rows.length === 0) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'matching' },
      });
      await this.notifications.notifyMatchingStarted({
        clientUserId: project.clientId,
        projectId,
        projectTitle: project.title,
        offerCount: 0,
      });
      return 0;
    }

    const ids = rows.map((r) => r.id);
    const surveyorGeo =
      ids.length === 0
        ? []
        : await this.prisma.$queryRawUnsafe<GeoRow[]>(
            `SELECT id::text AS id, ST_X(base_location::geometry) AS lng, ST_Y(base_location::geometry) AS lat
             FROM surveyor_profiles
             WHERE id = ANY($1::uuid[])`,
            ids,
          );
    const geoById = new Map(surveyorGeo.map((g) => [g.id, g]));

    const candidates: Candidate[] = [];
    for (const s of rows) {
      const services = (s.services as unknown as SurveyService[]) ?? [];
      const overlap = services.filter((svc) => projectServices.includes(svc)).length;
      if (overlap === 0) continue;

      const g = geoById.get(s.id);
      const base =
        g?.lng != null && g?.lat != null ? { lng: Number(g.lng), lat: Number(g.lat) } : null;
      const distanceKm =
        projectPoint && base ? Math.round(haversineKm(projectPoint, base) * 10) / 10 : null;

      if (projectPoint && base) {
        const radius = s.radiusKm > 0 ? s.radiusKm : 100;
        if (distanceKm != null && distanceKm > radius) continue;
      } else if (projectPoint && !base) {
        continue;
      }

      let score = overlap * 40;
      if (distanceKm != null) {
        const radius = s.radiusKm > 0 ? s.radiusKm : 100;
        score += Math.round(Math.max(0, 1 - distanceKm / radius) * 40);
      } else {
        score += 10;
      }
      if (s.bldVerified) score += 12;
      if (s.ratingAvg != null) score += Math.round((Number(s.ratingAvg) / 5) * 8);

      candidates.push({
        profileId: s.id,
        userId: s.userId,
        distanceKm,
        score,
      });
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    });

    const selected = candidates.slice(0, Math.max(1, this.maxOffers));
    const expiresAt = addWorkingHours(
      new Date(),
      this.responseWorkingHours,
      this.workingHours,
    );

    if (selected.length === 0) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'matching' },
      });
      await this.notifications.notifyMatchingStarted({
        clientUserId: project.clientId,
        projectId,
        projectTitle: project.title,
        offerCount: 0,
      });
      return 0;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { status: 'matching' },
      });
      for (const c of selected) {
        await tx.match.create({
          data: {
            projectId,
            surveyorId: c.profileId,
            matchedBy: project.clientId,
            status: 'proposed',
            offerSource: 'auto',
            expiresAt,
            adminNotes: 'Auto-matched offer',
          },
        });
      }
    });

    const matches = await this.prisma.match.findMany({
      where: { projectId, status: 'proposed', offerSource: 'auto' },
      select: { id: true, surveyorId: true },
    });
    const byProfile = new Map(matches.map((m) => [m.surveyorId, m.id]));

    await this.notifications.notifyMatchingStarted({
      clientUserId: project.clientId,
      projectId,
      projectTitle: project.title,
      offerCount: selected.length,
    });

    await Promise.allSettled(
      selected.map((c) => {
        const matchId = byProfile.get(c.profileId);
        if (!matchId) return Promise.resolve();
        return this.notifications.notifyMatchOffer({
          clientUserId: project.clientId,
          surveyorUserId: c.userId,
          projectId,
          matchId,
          projectTitle: project.title,
          responseWorkingHours: this.responseWorkingHours,
        });
      }),
    );

    this.logger.log(
      `Auto-matched project ${projectId} → ${selected.length} surveyor offer(s), expires ${expiresAt.toISOString()}`,
    );
    return selected.length;
  }

  /** Cancel open proposed offers past their working-hours deadline. */
  async expireStaleOffers(): Promise<number> {
    const now = new Date();
    const stale = await this.prisma.match.findMany({
      where: {
        status: 'proposed',
        expiresAt: { lte: now },
      },
      select: { id: true },
    });
    if (stale.length === 0) return 0;
    await this.prisma.match.updateMany({
      where: { id: { in: stale.map((m) => m.id) } },
      data: { status: 'cancelled' },
    });
    return stale.length;
  }

  /** Cancel sibling proposed offers when one surveyor accepts (or admin locks a match). */
  async cancelSiblingOffers(projectId: string, keepMatchId: string): Promise<void> {
    await this.prisma.match.updateMany({
      where: {
        projectId,
        status: 'proposed',
        id: { not: keepMatchId },
      },
      data: { status: 'cancelled' },
    });
  }

  getWorkingHoursConfig(): WorkingHoursConfig {
    return this.workingHours;
  }

  getResponseWorkingHours(): number {
    return this.responseWorkingHours;
  }
}
