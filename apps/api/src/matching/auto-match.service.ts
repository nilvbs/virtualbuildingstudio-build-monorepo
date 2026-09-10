import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SurveyService } from '@surveylink/types';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
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

type OfferOptions = {
  /** initial = client just posted; rematch = background / expiry retry */
  reason?: 'initial' | 'rematch';
};

/**
 * Uber-style auto-match: when a client posts a project, fan out proposed offers
 * to nearby live surveyors with a working-hours response deadline.
 * Keeps retrying open matching projects until a surveyor is found / accepts.
 */
@Injectable()
export class AutoMatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutoMatchService.name);
  private readonly maxOffers: number;
  private readonly responseWorkingHours: number;
  private readonly workingHours: WorkingHoursConfig;
  private readonly retryMs: number;
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private retryRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
  ) {
    this.maxOffers = Number(this.config.get('AUTO_MATCH_MAX_OFFERS') ?? 8);
    this.responseWorkingHours = Number(this.config.get('AUTO_MATCH_RESPONSE_HOURS') ?? 3);
    this.retryMs = Number(this.config.get('AUTO_MATCH_RETRY_MS') ?? 5 * 60_000);
    this.workingHours = {
      ...DEFAULT_WORKING_HOURS,
      timeZone: this.config.get('AUTO_MATCH_TZ') ?? DEFAULT_WORKING_HOURS.timeZone,
      startHour: Number(this.config.get('AUTO_MATCH_WORK_START') ?? DEFAULT_WORKING_HOURS.startHour),
      endHour: Number(this.config.get('AUTO_MATCH_WORK_END') ?? DEFAULT_WORKING_HOURS.endHour),
    };
  }

  onModuleInit(): void {
    if (this.retryMs <= 0) return;
    this.retryTimer = setInterval(() => {
      void this.retryOpenMatching();
    }, this.retryMs);
    // Unref so the timer doesn't keep the process alive in tests / short CLI runs.
    if (typeof this.retryTimer.unref === 'function') this.retryTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /** Run after a client creates a project. Best-effort — never fails the create. */
  async offerForProject(projectId: string, opts: OfferOptions = {}): Promise<number> {
    try {
      return await this.runOffer(projectId, opts);
    } catch (err) {
      this.logger.error(
        `Auto-match failed for project ${projectId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return 0;
    }
  }

  /**
   * Expire stale offers, then re-fan-out for any project still waiting on a match.
   * Also used when a new surveyor becomes matchable.
   */
  async retryOpenMatching(): Promise<void> {
    if (this.retryRunning) return;
    this.retryRunning = true;
    try {
      await this.expireStaleOffers();
      const waiting = await this.prisma.project.findMany({
        where: { status: { in: ['submitted', 'matching'] } },
        select: { id: true },
        take: 100,
        orderBy: { createdAt: 'asc' },
      });
      for (const p of waiting) {
        const open = await this.prisma.match.count({
          where: { projectId: p.id, status: 'proposed' },
        });
        if (open > 0) continue;
        const accepted = await this.prisma.match.count({
          where: { projectId: p.id, status: { in: ['accepted', 'completed'] } },
        });
        if (accepted > 0) continue;
        await this.offerForProject(p.id, { reason: 'rematch' });
      }
    } catch (err) {
      this.logger.error(
        `retryOpenMatching failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    } finally {
      this.retryRunning = false;
    }
  }

  private async runOffer(projectId: string, opts: OfferOptions = {}): Promise<number> {
    const reason = opts.reason ?? 'initial';
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
        reason,
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
        reason,
      });
      if (reason === 'initial') {
        await this.activity.record({
          entityType: 'project',
          entityId: projectId,
          projectId,
          action: 'project.matching_started',
          summary: `Auto-match searching for best surveyor for "${project.title}"`,
          metadata: { offerCount: 0 },
        });
      }
      return 0;
    }

    // Prefer surveyors who have not already declined this project.
    const prior = await this.prisma.match.findMany({
      where: { projectId, surveyorId: { in: selected.map((c) => c.profileId) } },
      select: { surveyorId: true, status: true },
    });
    const declined = new Set(
      prior.filter((m) => m.status === 'declined').map((m) => m.surveyorId),
    );
    const toOffer = selected.filter((c) => !declined.has(c.profileId));
    if (toOffer.length === 0) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: 'matching' },
      });
      await this.notifications.notifyMatchingStarted({
        clientUserId: project.clientId,
        projectId,
        projectTitle: project.title,
        offerCount: 0,
        reason,
      });
      return 0;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { status: 'matching' },
      });
      for (const c of toOffer) {
        await tx.match.create({
          data: {
            projectId,
            surveyorId: c.profileId,
            matchedBy: project.clientId,
            status: 'proposed',
            offerSource: 'auto',
            expiresAt,
            proposedAt: new Date(),
            adminNotes: reason === 'rematch' ? 'Auto-matched offer (retry)' : 'Auto-matched offer',
          },
        });
      }
    });

    const matches = await this.prisma.match.findMany({
      where: { projectId, status: 'proposed', offerSource: 'auto' },
      select: { id: true, surveyorId: true },
      orderBy: { createdAt: 'desc' },
      take: toOffer.length,
    });
    const byProfile = new Map(matches.map((m) => [m.surveyorId, m.id]));

    await this.notifications.notifyMatchingStarted({
      clientUserId: project.clientId,
      projectId,
      projectTitle: project.title,
      offerCount: toOffer.length,
      reason,
    });

    await this.activity.record({
      entityType: 'project',
      entityId: projectId,
      projectId,
      action: 'project.matching_started',
      summary: `Auto-match notified ${toOffer.length} surveyor(s)`,
      metadata: { offerCount: toOffer.length, reason },
    });

    await Promise.allSettled(
      toOffer.map((c) => {
        const matchId = byProfile.get(c.profileId);
        if (!matchId) return Promise.resolve();
        return Promise.all([
          this.notifications.notifyMatchOffer({
            clientUserId: project.clientId,
            surveyorUserId: c.userId,
            projectId,
            matchId,
            projectTitle: project.title,
            responseWorkingHours: this.responseWorkingHours,
          }),
          this.activity.record({
            entityType: 'match',
            entityId: matchId,
            projectId,
            matchId,
            action: 'match.offer_sent',
            summary: `Auto offer sent for "${project.title}"`,
            metadata: { surveyorProfileId: c.profileId, offerSource: 'auto', reason },
          }),
        ]);
      }),
    );

    this.logger.log(
      `Auto-matched project ${projectId} → ${toOffer.length} surveyor offer(s) (${reason}), expires ${expiresAt.toISOString()}`,
    );
    return toOffer.length;
  }

  /** Cancel open proposed offers past their working-hours deadline. */
  async expireStaleOffers(): Promise<number> {
    const now = new Date();
    const stale = await this.prisma.match.findMany({
      where: {
        status: 'proposed',
        expiresAt: { lte: now },
      },
      select: { id: true, projectId: true },
    });
    if (stale.length === 0) return 0;
    await this.prisma.match.updateMany({
      where: { id: { in: stale.map((m) => m.id) } },
      data: { status: 'cancelled', cancelledAt: now },
    });
    await Promise.allSettled(
      stale.map((m) =>
        this.activity.record({
          entityType: 'match',
          entityId: m.id,
          projectId: m.projectId,
          matchId: m.id,
          action: 'match.expired',
          summary: 'Offer expired (working-hours window ended)',
          metadata: { reason: 'expires_at' },
          occurredAt: now,
        }),
      ),
    );

    // Immediately try again for projects that lost their open offers.
    const projectIds = [...new Set(stale.map((m) => m.projectId))];
    for (const projectId of projectIds) {
      const stillOpen = await this.prisma.match.count({
        where: { projectId, status: 'proposed' },
      });
      if (stillOpen > 0) continue;
      const locked = await this.prisma.match.count({
        where: { projectId, status: { in: ['accepted', 'completed'] } },
      });
      if (locked > 0) continue;
      await this.offerForProject(projectId, { reason: 'rematch' });
    }

    return stale.length;
  }

  /** Cancel sibling proposed offers when one surveyor accepts (or admin locks a match). */
  async cancelSiblingOffers(projectId: string, keepMatchId: string): Promise<void> {
    const now = new Date();
    const siblings = await this.prisma.match.findMany({
      where: {
        projectId,
        status: 'proposed',
        id: { not: keepMatchId },
      },
      select: { id: true },
    });
    if (siblings.length === 0) return;
    await this.prisma.match.updateMany({
      where: { id: { in: siblings.map((s) => s.id) } },
      data: { status: 'cancelled', cancelledAt: now },
    });
    await Promise.allSettled(
      siblings.map((s) =>
        this.activity.record({
          entityType: 'match',
          entityId: s.id,
          projectId,
          matchId: s.id,
          action: 'match.cancelled',
          summary: 'Sibling offer cancelled after another surveyor was selected',
          metadata: { reason: 'sibling_accepted', keptMatchId: keepMatchId },
          occurredAt: now,
        }),
      ),
    );
  }

  getWorkingHoursConfig(): WorkingHoursConfig {
    return this.workingHours;
  }

  getResponseWorkingHours(): number {
    return this.responseWorkingHours;
  }
}
