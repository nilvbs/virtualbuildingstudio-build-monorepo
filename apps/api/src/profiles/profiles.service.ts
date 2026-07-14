import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type SurveyorProfile as SurveyorProfileRow, type User } from '@prisma/client';
import type {
  PortfolioItem,
  SurveyService,
  SurveyorProfile,
  SurveyorStatus,
} from '@surveylink/types';
import { surveyorProfileCompletion } from '@surveylink/types';
import type {
  CreateSurveyorProfileInput,
  UpdateSurveyorProfileInput,
} from '@surveylink/validation';
import { PrismaService } from '../prisma/prisma.service';

interface GeoRow {
  lng: number | null;
  lat: number | null;
}

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

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

    const row = await this.prisma.surveyorProfile.create({
      data: {
        userId: user.id,
        bio: input.bio ?? null,
        services: input.services as Prisma.InputJsonValue,
        equipment: input.equipment as Prisma.InputJsonValue,
        baseCity: input.baseCity ?? null,
        radiusKm: input.radiusKm,
        dayRateCents: input.dayRateCents != null ? BigInt(input.dayRateCents) : null,
        portfolio: input.portfolio as Prisma.InputJsonValue,
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
    const completion = surveyorProfileCompletion({
      services: (profile.services as unknown as SurveyService[]) ?? [],
      equipment: (profile.equipment as unknown as string[]) ?? [],
      bio: profile.bio,
      baseCity: profile.baseCity,
      location,
      dayRateCents: profile.dayRateCents != null ? Number(profile.dayRateCents) : null,
    });

    const matches = await this.prisma.match.findMany({
      where: { surveyorId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { title: true } } },
    });

    const hasProposed = matches.some((m) => m.status === 'proposed');
    const headline = !completion.complete
      ? 'Finish your profile to go live'
      : hasProposed
        ? "You've been matched to a project — we'll reach out."
        : "We're mapping projects to you.";
    const subtext = !completion.complete
      ? `Your profile is ${completion.percent}% complete. Dashboard unlocks at 100%.`
      : hasProposed
        ? 'Keep an eye on your phone and email; our team will confirm the details with you directly.'
        : "Your profile is live. When a project fits, we'll match you and get in touch.";

    return {
      hasProfile: true,
      isMatchable: profile.isMatchable && completion.complete,
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
      isMatchable: row.isMatchable,
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
