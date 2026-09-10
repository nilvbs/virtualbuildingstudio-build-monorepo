import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type SurveyorProfile as SurveyorProfileRow, type User } from '@prisma/client';
import type {
  MatchStatus,
  PortfolioItem,
  SurveyService,
  SurveyorPortfolioDetails,
  SurveyorProfile,
  SurveyorRequest,
  SurveyorStatus,
} from '@surveylink/types';
import {
  isValidTransition,
  MATCH_STATUS_TRANSITIONS,
  normalizePortfolioDetails,
  surveyorProfileCompletion,
} from '@surveylink/types';
import type {
  CreateSurveyorProfileInput,
  UpdateSurveyorProfileInput,
} from '@surveylink/validation';
import { haversineKm } from '../common/geo';
import { PrismaService } from '../prisma/prisma.service';
import { AutoMatchService } from '../matching/auto-match.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import {
  isWithinWorkingHours,
  remainingWorkingMs,
} from '../matching/working-hours';

interface GeoRow {
  lng: number | null;
  lat: number | null;
}

interface ProjectGeoRow {
  id: string;
  lng: number | null;
  lat: number | null;
}

function identityBio(details: SurveyorPortfolioDetails): string | null {
  const identity = details.identity;
  if (!identity) return null;
  if (identity.kind === 'individual') {
    return identity.aboutMe.trim() || identity.headline.trim() || null;
  }
  return identity.aboutCompany.trim() || identity.tagline.trim() || null;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly autoMatch: AutoMatchService,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityService,
  ) {}

  async createProfile(
    subject: string,
    input: CreateSurveyorProfileInput,
  ): Promise<SurveyorProfile> {
    const user = await this.requireUser(subject);

    const existing = await this.prisma.surveyorProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A surveyor profile already exists for this account');
    }

    const details = normalizePortfolioDetails(input.details ?? {});
    const bio = input.bio ?? identityBio(details);

    const row = await this.prisma.surveyorProfile.create({
      data: {
        userId: user.id,
        bio,
        services: input.services as Prisma.InputJsonValue,
        equipment: input.equipment as Prisma.InputJsonValue,
        baseCity: input.baseCity ?? null,
        radiusKm: input.radiusKm,
        dayRateCents: input.dayRateCents != null ? BigInt(input.dayRateCents) : null,
        portfolio: input.portfolio as Prisma.InputJsonValue,
        details: details as unknown as Prisma.InputJsonValue,
        isMatchable: input.isMatchable,
      },
    });

    if (input.location) {
      await this.writeLocation(row.id, input.location.lng, input.location.lat);
    }

    return this.getByUserId(user.id);
  }

  async getProfile(subject: string): Promise<SurveyorProfile> {
    const user = await this.requireUser(subject);
    return this.getByUserId(user.id);
  }

  async updateProfile(
    subject: string,
    input: UpdateSurveyorProfileInput,
  ): Promise<SurveyorProfile> {
    const user = await this.requireUser(subject);
    const existing = await this.prisma.surveyorProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('No surveyor profile to update');
    }

    const data: Prisma.SurveyorProfileUpdateInput = {};
    if (input.bio !== undefined) data.bio = input.bio;
    if (input.services !== undefined) data.services = input.services as Prisma.InputJsonValue;
    if (input.equipment !== undefined) data.equipment = input.equipment as Prisma.InputJsonValue;
    if (input.baseCity !== undefined) data.baseCity = input.baseCity;
    if (input.radiusKm !== undefined) data.radiusKm = input.radiusKm;
    if (input.dayRateCents !== undefined) {
      data.dayRateCents = input.dayRateCents != null ? BigInt(input.dayRateCents) : null;
    }
    if (input.portfolio !== undefined) data.portfolio = input.portfolio as Prisma.InputJsonValue;
    if (input.isMatchable !== undefined) data.isMatchable = input.isMatchable;
    if (input.details !== undefined) {
      const details = normalizePortfolioDetails(input.details);
      data.details = details as unknown as Prisma.InputJsonValue;
      if (input.bio === undefined) {
        data.bio = identityBio(details);
      }
    }

    await this.prisma.surveyorProfile.update({ where: { id: existing.id }, data });

    if (input.location !== undefined) {
      await this.writeLocation(existing.id, input.location.lng, input.location.lat);
    }

    return this.getByUserId(user.id);
  }

  async getStatus(subject: string): Promise<SurveyorStatus> {
    const user = await this.requireUser(subject);
    const profile = await this.prisma.surveyorProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return {
        hasProfile: false,
        isMatchable: false,
        matchablePreference: false,
        headline: 'Set up your surveyor profile',
        subtext: 'Tell us your services and coverage so we can start mapping projects to you.',
        matches: [],
        completionPercent: 0,
        profileComplete: false,
      };
    }

    const geo = await this.prisma.$queryRaw<GeoRow[]>`
      SELECT ST_X(base_location::geometry) AS lng, ST_Y(base_location::geometry) AS lat
      FROM surveyor_profiles WHERE id = ${profile.id}::uuid`;
    const point = geo[0];
    const location =
      point && point.lng != null && point.lat != null
        ? { lng: Number(point.lng), lat: Number(point.lat) }
        : null;
    const details = normalizePortfolioDetails(
      (profile as { details?: unknown }).details ?? {},
    );
    const completion = surveyorProfileCompletion({
      services: (profile.services as unknown as SurveyService[]) ?? [],
      equipment: (profile.equipment as unknown as string[]) ?? [],
      bio: profile.bio,
      baseCity: profile.baseCity,
      location,
      dayRateCents: profile.dayRateCents != null ? Number(profile.dayRateCents) : null,
      details,
    });

    const matches = await this.prisma.match.findMany({
      where: {
        surveyorId: profile.id,
        // Surveyors never see declined (or cancelled) matches in their status feed.
        status: { notIn: ['declined', 'cancelled'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { title: true } } },
    });

    const hasProposed = matches.some((m) => m.status === 'proposed');
    const headline = !completion.complete
      ? 'Finish your profile to go live'
      : hasProposed
        ? "You've been matched to a project — review it in My Requests."
        : "We're mapping projects to you.";
    const subtext = !completion.complete
      ? `Your profile is ${completion.percent}% complete. Matching unlocks at 100%.`
      : hasProposed
        ? 'Open My Requests to accept or decline. Accepted work moves to My Matches.'
        : "Your profile is live. When a project fits, we'll send it to My Requests.";

    return {
      hasProfile: true,
      isMatchable: profile.isMatchable && completion.complete,
      matchablePreference: profile.isMatchable,
      headline,
      subtext,
      matches: matches.map((m) => ({
        matchId: m.id,
        status: m.status as SurveyorStatus['matches'][number]['status'],
        projectTitle: m.project.title,
        createdAt: m.createdAt.toISOString(),
      })),
      completionPercent: completion.percent,
      profileComplete: completion.complete,
    };
  }

  private async writeLocation(profileId: string, lng: number, lat: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE surveyor_profiles
      SET base_location = ST_SetSRID(ST_MakePoint(${lng}::double precision, ${lat}::double precision), 4326)::geography,
          updated_at = now()
      WHERE id = ${profileId}::uuid`;
  }

  private async getByUserId(userId: string): Promise<SurveyorProfile> {
    const row = await this.prisma.surveyorProfile.findUnique({ where: { userId } });
    if (!row) {
      throw new NotFoundException('Surveyor profile not found');
    }
    const geo = await this.prisma.$queryRaw<GeoRow[]>`
      SELECT ST_X(base_location::geometry) AS lng, ST_Y(base_location::geometry) AS lat
      FROM surveyor_profiles WHERE id = ${row.id}::uuid`;
    const point = geo[0];
    const location =
      point && point.lng != null && point.lat != null
        ? { lng: Number(point.lng), lat: Number(point.lat) }
        : null;
    return this.toDto(row, location);
  }

  private toDto(
    row: SurveyorProfileRow,
    location: { lng: number; lat: number } | null,
  ): SurveyorProfile {
    return {
      id: row.id,
      userId: row.userId,
      bio: row.bio,
      services: (row.services as unknown as SurveyService[]) ?? [],
      equipment: (row.equipment as unknown as string[]) ?? [],
      location,
      baseCity: row.baseCity,
      radiusKm: row.radiusKm,
      dayRateCents: row.dayRateCents != null ? Number(row.dayRateCents) : null,
      portfolio: (row.portfolio as unknown as PortfolioItem[]) ?? [],
      details: normalizePortfolioDetails((row as { details?: unknown }).details ?? {}),
      isMatchable: row.isMatchable,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Return all proposed matches for this surveyor with full project + client info.
   */
  async getRequests(subject: string): Promise<SurveyorRequest[]> {
    return this.listSurveyorMatches(subject, ['proposed']);
  }

  /**
   * Accepted / completed matches with full project details for My Matches.
   */
  async getMatches(subject: string): Promise<SurveyorRequest[]> {
    return this.listSurveyorMatches(subject, ['accepted', 'completed']);
  }

  private async listSurveyorMatches(
    subject: string,
    statuses: MatchStatus[],
  ): Promise<SurveyorRequest[]> {
    await this.autoMatch.expireStaleOffers();

    const user = await this.requireUser(subject);
    const profile = await this.prisma.surveyorProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!profile) return [];

    const baseGeo = await this.prisma.$queryRaw<GeoRow[]>`
      SELECT ST_X(base_location::geometry) AS lng, ST_Y(base_location::geometry) AS lat
      FROM surveyor_profiles WHERE id = ${profile.id}::uuid`;
    const basePoint =
      baseGeo[0]?.lng != null && baseGeo[0]?.lat != null
        ? { lng: Number(baseGeo[0].lng), lat: Number(baseGeo[0].lat) }
        : null;

    const matches = await this.prisma.match.findMany({
      where: { surveyorId: profile.id, status: { in: statuses } },
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          include: {
            client: {
              select: {
                username: true,
                accountProfile: { select: { companyName: true } },
              },
            },
          },
        },
      },
    });

    if (matches.length === 0) return [];

    const projectIds = matches.map((m) => m.project.id);
    const projectGeo =
      projectIds.length === 0
        ? []
        : await this.prisma.$queryRawUnsafe<ProjectGeoRow[]>(
            `SELECT id::text AS id, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
             FROM projects
             WHERE id = ANY($1::uuid[])`,
            projectIds,
          );
    const geoById = new Map(
      projectGeo.map((g) => [
        g.id,
        g.lng != null && g.lat != null ? { lng: Number(g.lng), lat: Number(g.lat) } : null,
      ]),
    );

    const myFeedback = await this.prisma.feedback.findMany({
      where: {
        fromUserId: user.id,
        matchId: { in: matches.map((m) => m.id) },
      },
      select: { matchId: true },
    });
    const submitted = new Set(myFeedback.map((f) => f.matchId));

    return matches.map((m) => {
      const location = geoById.get(m.project.id) ?? null;
      const distanceKm =
        basePoint && location
          ? Math.round(haversineKm(basePoint, location) * 10) / 10
          : null;
      const expiresAt = (m as { expiresAt?: Date | null }).expiresAt ?? null;
      const now = new Date();
      const wh = this.autoMatch.getWorkingHoursConfig();
      const remainingMs =
        expiresAt && m.status === 'proposed'
          ? remainingWorkingMs(now, expiresAt, wh)
          : null;
      const canLeave =
        (m.status === 'completed' || m.project.status === 'completed') &&
        ['accepted', 'completed'].includes(m.status) &&
        !submitted.has(m.id);
      return {
        matchId: m.id,
        status: m.status as MatchStatus,
        createdAt: m.createdAt.toISOString(),
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        remainingWorkingMs: remainingMs,
        responseWindowPaused:
          m.status === 'proposed' && expiresAt ? !isWithinWorkingHours(now, wh) : false,
        offerSource: ((m as { offerSource?: string }).offerSource ?? 'admin') as
          | 'admin'
          | 'auto',
        project: {
          id: m.project.id,
          title: m.project.title,
          services: (m.project.services as unknown as SurveyService[]) ?? [],
          location,
          locationText: m.project.locationText,
          distanceKm,
          buildingType: m.project.buildingType,
          buildingAge: m.project.buildingAge,
          floors: m.project.floors,
          areaSqft: m.project.areaSqft,
          neededWithin: m.project.neededWithin,
          notes: m.project.notes,
          status: m.project.status as SurveyorRequest['project']['status'],
          createdAt: m.project.createdAt.toISOString(),
        },
        client: {
          username: m.project.client.username,
          companyName: m.project.client.accountProfile?.companyName ?? null,
        },
        feedbackSubmitted: submitted.has(m.id),
        canLeaveFeedback: canLeave,
      };
    });
  }

  /**
   * Surveyor accepts a proposed match.
   */
  async acceptMatch(subject: string, matchId: string): Promise<{ matchId: string; status: string }> {
    return this.transitionMatch(subject, matchId, 'accepted');
  }

  /**
   * Surveyor declines a proposed match.
   */
  async declineMatch(subject: string, matchId: string): Promise<{ matchId: string; status: string }> {
    return this.transitionMatch(subject, matchId, 'declined');
  }

  private async transitionMatch(
    subject: string,
    matchId: string,
    target: MatchStatus,
  ): Promise<{ matchId: string; status: string }> {
    await this.autoMatch.expireStaleOffers();

    const user = await this.requireUser(subject);
    const profile = await this.prisma.surveyorProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('No surveyor profile');

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { project: { select: { id: true, clientId: true, title: true } } },
    });
    if (!match || match.surveyorId !== profile.id) {
      throw new NotFoundException('Match not found');
    }

    if (match.status === 'proposed' && match.expiresAt && match.expiresAt.getTime() <= Date.now()) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });
      throw new ConflictException('This request expired (working-hours window ended)');
    }

    if (!isValidTransition(MATCH_STATUS_TRANSITIONS, match.status as MatchStatus, target)) {
      throw new ConflictException(`Cannot move match from ${match.status} to ${target}`);
    }

    const now = new Date();
    const milestone: Record<string, Date> = {};
    if (target === 'accepted') milestone.acceptedAt = now;
    if (target === 'declined') milestone.declinedAt = now;
    if (target === 'cancelled') milestone.cancelledAt = now;
    if (target === 'completed') milestone.completedAt = now;

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: { status: target, ...milestone },
    });

    if (target === 'accepted') {
      await this.autoMatch.cancelSiblingOffers(match.projectId, matchId);
      await this.prisma.project.update({
        where: { id: match.projectId },
        data: { status: 'matched' },
      });
      await this.notifications.notifyMatchAccepted({
        clientUserId: match.project.clientId,
        surveyorUserId: user.id,
        projectId: match.project.id,
        matchId,
        projectTitle: match.project.title,
      });
      await this.activity.record({
        entityType: 'match',
        entityId: matchId,
        projectId: match.projectId,
        matchId,
        action: 'match.accepted',
        summary: `Surveyor accepted "${match.project.title}"`,
        actorUserId: user.id,
      });
      await this.activity.record({
        entityType: 'project',
        entityId: match.projectId,
        projectId: match.projectId,
        matchId,
        action: 'project.matched',
        summary: `Project matched after surveyor accept`,
        actorUserId: user.id,
      });
    } else {
      await this.activity.record({
        entityType: 'match',
        entityId: matchId,
        projectId: match.projectId,
        matchId,
        action: `match.${target}`,
        summary: `Match ${match.status} → ${target}`,
        actorUserId: user.id,
        metadata: { fromStatus: match.status, toStatus: target },
      });
    }

    return { matchId: updated.id, status: updated.status };
  }

  private async requireUser(subject: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { authSubject: subject } });
    if (!user) {
      throw new NotFoundException('No local account is linked to this identity');
    }
    return user;
  }
}
