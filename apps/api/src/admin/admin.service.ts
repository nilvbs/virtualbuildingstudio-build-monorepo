import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Match as MatchRow } from '@prisma/client';
import {
  MATCH_STATUS_TRANSITIONS,
  PROJECT_STATUS_TRANSITIONS,
  isValidTransition,
  normalizePortfolioDetails,
  resolveStaffPermissions,
  type AdminClient,
  type AdminClientDetail,
  type AdminClientProjectSummary,
  type AdminOverviewStats,
  type AdminQueues,
  type AdminQueueProject,
  type AdminSurveyor,
  type AdminSurveyorDetail,
  type AdminUser,
  type AdminUserDetail,
  type Match,
  type MatchStatus,
  type MembershipRole,
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
  AdminOverviewQuery,
  AdminProjectsQuery,
  AdminSurveyorQuery,
  AdminUsersQuery,
  AdminVerifyContactInput,
  CreateMatchInput,
  CreateStaffAdminInput,
  UpdateAdminUserInput,
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
import { buildPersonNameFields } from '../auth/username';
import { verifyPassword } from '../auth/password-verifier';
import { AutoMatchService } from '../matching/auto-match.service';
import { addWorkingHours } from '../matching/working-hours';
import { ActivityService } from '../activity/activity.service';

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
    private readonly autoMatch: AutoMatchService,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
    private readonly activity: ActivityService,
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

  /**
   * Filtered overview analytics for the operations home — totals, period adds,
   * and a location breakdown. Still aggregate-only (no row PII beyond city labels).
   */
  async getOverview(query: AdminOverviewQuery): Promise<AdminOverviewStats> {
    const from = query.from ? startOfUtcDay(query.from) : null;
    const to = query.to ? endOfUtcDay(query.to) : null;
    const locationFilter = query.location?.trim() || null;
    const locationNeedle = locationFilter?.toLowerCase() ?? null;

    const [clients, surveyors, projects, feedbackRows] = await Promise.all([
      this.prisma.user.findMany({
        where: { roles: { some: { role: 'client' } } },
        select: {
          id: true,
          createdAt: true,
          accountProfile: { select: { city: true, state: true, country: true } },
        },
      }),
      this.prisma.surveyorProfile.findMany({
        select: { id: true, createdAt: true, baseCity: true, isMatchable: true },
      }),
      this.prisma.project.findMany({
        select: { id: true, createdAt: true, locationText: true, status: true },
      }),
      this.prisma.feedback.findMany({
        select: {
          rating: true,
          fromRole: true,
          recommend: true,
          createdAt: true,
        },
      }),
    ]);

    const clientRows = clients.map((c) => ({
      createdAt: c.createdAt,
      label: locationLabel([
        c.accountProfile?.city,
        c.accountProfile?.state,
        c.accountProfile?.country,
      ]),
    }));
    const surveyorRows = surveyors.map((s) => ({
      createdAt: s.createdAt,
      isMatchable: s.isMatchable,
      label: locationLabel([s.baseCity]),
    }));
    const projectRows = projects.map((p) => ({
      createdAt: p.createdAt,
      status: p.status,
      label: locationLabelFromText(p.locationText),
    }));

    const allLabels = new Set<string>();
    for (const row of [...clientRows, ...surveyorRows, ...projectRows]) {
      if (row.label !== 'Unknown') allLabels.add(row.label);
    }
    const availableLocations = [...allLabels].sort((a, b) => a.localeCompare(b));

    const matchLoc = (label: string) =>
      !locationNeedle || label.toLowerCase().includes(locationNeedle);

    const clientsScoped = clientRows.filter((r) => matchLoc(r.label));
    const surveyorsScoped = surveyorRows.filter((r) => matchLoc(r.label));
    const projectsScoped = projectRows.filter((r) => matchLoc(r.label));

    const inPeriod = (d: Date) => {
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };

    const locationMap = new Map<
      string,
      { clients: number; surveyors: number; projects: number }
    >();
    const bump = (label: string, key: 'clients' | 'surveyors' | 'projects') => {
      const cur = locationMap.get(label) ?? { clients: 0, surveyors: 0, projects: 0 };
      cur[key] += 1;
      locationMap.set(label, cur);
    };
    for (const r of clientsScoped) bump(r.label, 'clients');
    for (const r of surveyorsScoped) bump(r.label, 'surveyors');
    for (const r of projectsScoped) bump(r.label, 'projects');

    const locations = [...locationMap.entries()]
      .map(([label, counts]) => ({ label, ...counts }))
      .sort((a, b) => {
        const ta = a.clients + a.surveyors + a.projects;
        const tb = b.clients + b.surveyors + b.projects;
        return tb - ta || a.label.localeCompare(b.label);
      })
      .slice(0, 12);

    const feedbackInPeriod = feedbackRows.filter((f) => inPeriod(f.createdAt));
    const feedbackScoped = from || to ? feedbackInPeriod : feedbackRows;
    const ratingSum = feedbackScoped.reduce((acc, f) => acc + f.rating, 0);
    const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: feedbackScoped.filter((f) => f.rating === rating).length,
    }));

    return {
      filters: {
        from: query.from ?? null,
        to: query.to ?? null,
        location: locationFilter,
      },
      totals: {
        clients: clientsScoped.length,
        surveyors: surveyorsScoped.length,
        matchableSurveyors: surveyorsScoped.filter((s) => s.isMatchable).length,
        projects: projectsScoped.length,
        openProjects: projectsScoped.filter((p) =>
          OPEN_PROJECT_STATUSES.includes(p.status as ProjectStatus),
        ).length,
      },
      period: {
        clientsAdded: clientsScoped.filter((r) => inPeriod(r.createdAt)).length,
        surveyorsAdded: surveyorsScoped.filter((r) => inPeriod(r.createdAt)).length,
        projectsPosted: projectsScoped.filter((r) => inPeriod(r.createdAt)).length,
        feedbackSubmitted: feedbackInPeriod.length,
      },
      feedback: {
        total: feedbackScoped.length,
        averageRating:
          feedbackScoped.length > 0
            ? Math.round((ratingSum / feedbackScoped.length) * 10) / 10
            : null,
        recommendYes: feedbackScoped.filter((f) => f.recommend === true).length,
        recommendNo: feedbackScoped.filter((f) => f.recommend === false).length,
        fromClients: feedbackScoped.filter((f) => f.fromRole === 'client').length,
        fromSurveyors: feedbackScoped.filter((f) => f.fromRole === 'surveyor').length,
        ratingDistribution,
      },
      locations,
      availableLocations,
    };
  }

  async listClients(): Promise<AdminClient[]> {
    const rows = await this.prisma.user.findMany({
      where: { roles: { some: { role: 'client' } } },
      orderBy: { createdAt: 'desc' },
      include: {
        accountProfile: { select: { companyName: true, city: true } },
        projects: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: {
            matches: {
              where: { status: { in: ['accepted', 'completed', 'proposed'] } },
              orderBy: { createdAt: 'desc' },
              include: {
                surveyor: { include: { user: { select: { fullName: true } } } },
              },
            },
          },
        },
        _count: { select: { projects: true } },
      },
    });
    return rows.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      companyName: u.accountProfile?.companyName ?? null,
      city: u.accountProfile?.city ?? null,
      emailVerified: u.emailVerified,
      phoneVerified: u.phoneVerified,
      projectCount: u._count.projects,
      recentProjects: u.projects.map((p) => toClientProjectSummary(p)),
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async getClient(clientId: string): Promise<AdminClientDetail> {
    const u = await this.prisma.user.findFirst({
      where: { id: clientId, roles: { some: { role: 'client' } } },
      include: {
        accountProfile: true,
        projects: {
          orderBy: { createdAt: 'desc' },
          include: {
            matches: {
              where: { status: { in: ['accepted', 'completed', 'proposed'] } },
              orderBy: { createdAt: 'desc' },
              include: {
                surveyor: { include: { user: { select: { fullName: true } } } },
              },
            },
          },
        },
      },
    });
    if (!u) throw new NotFoundException('Client not found');
    const ap = u.accountProfile;
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      emailVerified: u.emailVerified,
      phoneVerified: u.phoneVerified,
      accountType: u.accountType,
      companyName: ap?.companyName ?? null,
      addressLine1: ap?.addressLine1 ?? null,
      addressLine2: ap?.addressLine2 ?? null,
      city: ap?.city ?? null,
      state: ap?.state ?? null,
      postalCode: ap?.postalCode ?? null,
      country: ap?.country ?? null,
      workEmail: ap?.workEmail ?? null,
      workEmailVerified: ap?.workEmailVerified ?? false,
      registrationNumber: ap?.registrationNumber ?? null,
      website: ap?.website ?? null,
      projectCount: u.projects.length,
      projects: u.projects.map((p) => toClientProjectSummary(p)),
      createdAt: u.createdAt.toISOString(),
    };
  }

  async listOpenProjects(query: Partial<AdminProjectsQuery> = {}): Promise<AdminQueueProject[]> {
    const scope = query.scope ?? 'pipeline';
    const openProjects = await this.prisma.project.findMany({
      where: {
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(scope === 'all' ? {} : { status: { in: OPEN_PROJECT_STATUSES } }),
      },
      orderBy: { createdAt: 'desc' },
      take: scope === 'all' ? 500 : 200,
      include: {
        client: { select: { id: true, fullName: true } },
        matches: {
          where: { status: { in: ['accepted', 'completed', 'proposed'] } },
          orderBy: { createdAt: 'desc' },
          include: {
            surveyor: { include: { user: { select: { fullName: true } } } },
          },
        },
      },
    });
    return openProjects.map((p) => ({
      id: p.id,
      title: p.title,
      clientId: p.client.id,
      clientName: p.client.fullName,
      services: (p.services as unknown as SurveyService[]) ?? [],
      locationText: p.locationText,
      status: p.status as ProjectStatus,
      assignedSurveyor: pickAssignedSurveyor(p.matches),
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async getSurveyor(profileId: string): Promise<AdminSurveyorDetail> {
    const s = await this.prisma.surveyorProfile.findUnique({
      where: { id: profileId },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            phone: true,
            emailVerified: true,
            phoneVerified: true,
          },
        },
      },
    });
    if (!s) throw new NotFoundException('Surveyor not found');

    const geo = await this.prisma.$queryRaw<GeoRow[]>`
      SELECT id::text AS id, ST_X(base_location::geometry) AS lng, ST_Y(base_location::geometry) AS lat
      FROM surveyor_profiles WHERE id = ${profileId}::uuid`;
    const g = geo[0];
    const location =
      g && g.lng != null && g.lat != null ? { lng: Number(g.lng), lat: Number(g.lat) } : null;

    return {
      profileId: s.id,
      userId: s.userId,
      fullName: s.user.fullName,
      email: s.user.email,
      phone: s.user.phone,
      emailVerified: s.user.emailVerified,
      phoneVerified: s.user.phoneVerified,
      baseCity: s.baseCity,
      services: (s.services as unknown as SurveyService[]) ?? [],
      equipment: (s.equipment as unknown as string[]) ?? [],
      radiusKm: s.radiusKm,
      dayRateCents: s.dayRateCents != null ? Number(s.dayRateCents) : null,
      isMatchable: s.isMatchable,
      location,
      distanceKm: null,
      bio: s.bio,
      details: normalizePortfolioDetails((s as { details?: unknown }).details ?? {}),
      bldVerified: s.bldVerified,
      ratingAvg: s.ratingAvg != null ? Number(s.ratingAvg) : null,
      ratingCount: s.ratingCount,
      createdAt: s.createdAt.toISOString(),
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
    const expiresAt = addWorkingHours(
      new Date(),
      this.autoMatch.getResponseWorkingHours(),
      this.autoMatch.getWorkingHoursConfig(),
    );
    const [match] = await this.prisma.$transaction([
      this.prisma.match.create({
        data: {
          projectId: input.projectId,
          surveyorId: input.surveyorId,
          matchedBy: adminUserId,
          status: 'proposed',
          adminNotes: input.notes ?? null,
          offerSource: 'admin',
          expiresAt,
          proposedAt: new Date(),
        },
      }),
      this.prisma.project.update({
        where: { id: input.projectId },
        data: { status: 'matched' },
      }),
    ]);

    await this.autoMatch.cancelSiblingOffers(input.projectId, match.id);

    await this.notifications.notifyMatchCreated({
      clientUserId: project.clientId,
      surveyorUserId: surveyor.userId,
      projectId: project.id,
      matchId: match.id,
      projectTitle: project.title,
    });

    await this.activity.record({
      entityType: 'match',
      entityId: match.id,
      projectId: project.id,
      matchId: match.id,
      action: 'match.proposed',
      summary: `Surveyor assigned to "${project.title}"`,
      actorUserId: adminUserId,
      metadata: { surveyorProfileId: input.surveyorId, offerSource: 'admin' },
    });
    await this.activity.record({
      entityType: 'project',
      entityId: project.id,
      projectId: project.id,
      matchId: match.id,
      action: 'project.surveyor_assigned',
      summary: `Project moved to matched — surveyor proposed`,
      actorUserId: adminUserId,
      metadata: { fromStatus: project.status, toStatus: 'matched' },
    });

    return this.toMatchDto(match);
  }

  async updateMatch(id: string, input: UpdateMatchInput): Promise<Match> {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException('Match not found');

    const data: Prisma.MatchUpdateInput = {};
    const now = new Date();
    if (input.status !== undefined) {
      if (!isValidTransition(MATCH_STATUS_TRANSITIONS, match.status as MatchStatus, input.status)) {
        throw new BadRequestException(
          `Cannot move match from ${match.status} to ${input.status}`,
        );
      }
      data.status = input.status;
      if (input.status === 'accepted') data.acceptedAt = now;
      if (input.status === 'completed') data.completedAt = now;
      if (input.status === 'declined') data.declinedAt = now;
      if (input.status === 'cancelled') data.cancelledAt = now;
    }
    if (input.adminNotes !== undefined) data.adminNotes = input.adminNotes;

    const updated = await this.prisma.match.update({ where: { id }, data });

    if (input.status !== undefined && input.status !== match.status) {
      await this.activity.record({
        entityType: 'match',
        entityId: updated.id,
        projectId: updated.projectId,
        matchId: updated.id,
        action: `match.${input.status}`,
        summary: `Match status ${match.status} → ${input.status}`,
        metadata: { fromStatus: match.status, toStatus: input.status },
      });
    }

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

    const adminUserId = await this.requireUserId(adminSubject).catch(() => null);
    await this.prisma.project.update({ where: { id }, data: { status: input.status } });

    await this.activity.record({
      entityType: 'project',
      entityId: id,
      projectId: id,
      action: `project.${input.status}`,
      summary: `Project status ${project.status} → ${input.status}`,
      actorUserId: adminUserId,
      metadata: { fromStatus: project.status, toStatus: input.status },
    });

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
      const names = await buildPersonNameFields(this.prisma, {
        firstName: input.firstName,
        lastName: input.lastName,
      });
      user = await this.prisma.user.create({
        data: {
          ...names,
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
      const names = await buildPersonNameFields(this.prisma, {
        firstName: input.firstName,
        lastName: input.lastName,
      });
      const identity = await this.identity.createIdentity({
        fullName: names.fullName,
        email,
        phone: input.phone,
        password: input.password,
      });
      user = await this.prisma.user.create({
        data: {
          ...names,
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

  async listUsers(query: AdminUsersQuery = {}): Promise<AdminUser[]> {
    const term = query.q?.trim();
    const rows = await this.prisma.user.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.role ? { roles: { some: { role: query.role } } } : {}),
        ...(term
          ? {
              OR: [
                { fullName: { contains: term, mode: 'insensitive' } },
                { email: { contains: term, mode: 'insensitive' } },
                { phone: { contains: term, mode: 'insensitive' } },
                { username: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        roles: { select: { role: true } },
        accountProfile: { select: { companyName: true, city: true } },
      },
    });
    return rows.map((u) => this.toAdminUserDto(u));
  }

  async getUser(userId: string): Promise<AdminUserDetail> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { select: { role: true } },
        accountProfile: true,
        adminProfile: { select: { staffLevel: true } },
        _count: { select: { projects: true } },
      },
    });
    if (!u) throw new NotFoundException('User not found');
    return this.toAdminUserDetailDto(u);
  }

  async updateUser(userId: string, input: UpdateAdminUserInput): Promise<AdminUserDetail> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { accountProfile: true, adminProfile: true },
    });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.adminProfile?.staffLevel === 'super_admin' && input.status === 'suspended') {
      throw new ForbiddenException('Cannot suspend the super admin');
    }

    if (input.email) {
      const email = normalizeEmail(input.email);
      const clash = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, NOT: { id: userId } },
        select: { id: true },
      });
      if (clash) throw new ConflictException('Another account already uses that email');
    }
    if (input.phone) {
      const clash = await this.prisma.user.findFirst({
        where: { phone: input.phone, NOT: { id: userId } },
        select: { id: true },
      });
      if (clash) throw new ConflictException('Another account already uses that phone number');
    }

    const firstName = input.firstName?.trim() ?? existing.firstName;
    const lastName = input.lastName?.trim() ?? existing.lastName;
    const fullName =
      input.firstName !== undefined || input.lastName !== undefined
        ? `${firstName} ${lastName}`.trim()
        : existing.fullName;

    const profilePatch = {
      companyName: input.companyName,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country,
      workEmail:
        input.workEmail === undefined
          ? undefined
          : input.workEmail === '' || input.workEmail === null
            ? null
            : normalizeEmail(input.workEmail),
      website: input.website,
      registrationNumber: input.registrationNumber,
    };
    const hasProfilePatch = Object.values(profilePatch).some((v) => v !== undefined);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          firstName,
          lastName,
          fullName,
          ...(input.email ? { email: normalizeEmail(input.email) } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.accountType ? { accountType: input.accountType } : {}),
        },
      });

      if (hasProfilePatch) {
        const data = Object.fromEntries(
          Object.entries(profilePatch).filter(([, v]) => v !== undefined),
        );
        await tx.accountProfile.upsert({
          where: { userId },
          create: { userId, ...data },
          update: data,
        });
      }
    });

    return this.getUser(userId);
  }

  async deleteUser(actorSubject: string, userId: string): Promise<void> {
    const actor = await this.prisma.user.findUnique({
      where: { authSubject: actorSubject },
      select: { id: true },
    });
    if (!actor) throw new NotFoundException('No local account is linked to this admin identity');
    if (actor.id === userId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        adminProfile: true,
        surveyorProfile: { select: { id: true } },
        roles: { select: { role: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.adminProfile?.staffLevel === 'super_admin') {
      throw new ForbiddenException('Cannot delete the super admin');
    }
    if (user.roles.some((r) => r.role === 'admin')) {
      throw new BadRequestException(
        'This account has staff access. Remove the admin role from Staff first, then delete.',
      );
    }

    const surveyorProfileId = user.surveyorProfile?.id;
    const authSubject = user.authSubject;

    await this.prisma.$transaction(async (tx) => {
      // Clear match FKs that would block project / user deletes.
      if (surveyorProfileId) {
        await tx.match.deleteMany({ where: { surveyorId: surveyorProfileId } });
      }
      const projectIds = (
        await tx.project.findMany({ where: { clientId: userId }, select: { id: true } })
      ).map((p) => p.id);
      if (projectIds.length) {
        await tx.match.deleteMany({ where: { projectId: { in: projectIds } } });
        await tx.feedback.deleteMany({ where: { projectId: { in: projectIds } } });
        await tx.project.deleteMany({ where: { id: { in: projectIds } } });
      }
      await tx.match.deleteMany({ where: { matchedBy: userId } });
      await tx.feedback.deleteMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    });

    if (authSubject) {
      await this.identity.deleteIdentity(authSubject);
    }
  }

  /**
   * Super admin marks a user's email or phone as verified after re-entering
   * their own password (so the action can't be done from a borrowed session alone).
   */
  async verifyUserContact(
    actorSubject: string,
    userId: string,
    input: AdminVerifyContactInput,
  ): Promise<AdminUserDetail> {
    await this.requireSuperAdmin(actorSubject);
    await this.assertActorPassword(actorSubject, input.password);

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, emailVerified: true, phoneVerified: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    if (input.channel === 'email') {
      if (existing.emailVerified) {
        throw new BadRequestException('Email is already verified');
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });
    } else {
      if (existing.phoneVerified) {
        throw new BadRequestException('Phone is already verified');
      }
      await this.prisma.user.update({
        where: { id: userId },
        data: { phoneVerified: true },
      });
    }

    return this.getUser(userId);
  }

  private toAdminUserDto(u: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    accountType: string;
    status: string;
    onboardingStep: string;
    authProvider: string | null;
    createdAt: Date;
    updatedAt: Date;
    roles: Array<{ role: string }>;
    accountProfile: { companyName: string | null; city: string | null } | null;
  }): AdminUser {
    return {
      id: u.id,
      fullName: u.fullName,
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      email: u.email,
      phone: u.phone,
      emailVerified: u.emailVerified,
      phoneVerified: u.phoneVerified,
      accountType: u.accountType,
      status: u.status as UserStatus,
      roles: u.roles
        .map((r) => r.role)
        .filter((r): r is MembershipRole =>
          r === 'client' || r === 'surveyor' || r === 'admin',
        ),
      onboardingStep: u.onboardingStep,
      authProvider: u.authProvider,
      companyName: u.accountProfile?.companyName ?? null,
      city: u.accountProfile?.city ?? null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }

  private toAdminUserDetailDto(u: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    accountType: string;
    status: string;
    onboardingStep: string;
    authProvider: string | null;
    createdAt: Date;
    updatedAt: Date;
    roles: Array<{ role: string }>;
    accountProfile: {
      companyName: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      country: string | null;
      workEmail: string | null;
      workEmailVerified: boolean;
      registrationNumber: string | null;
      website: string | null;
    } | null;
    adminProfile: { staffLevel: string } | null;
    _count: { projects: number };
  }): AdminUserDetail {
    const base = this.toAdminUserDto({
      ...u,
      accountProfile: u.accountProfile
        ? { companyName: u.accountProfile.companyName, city: u.accountProfile.city }
        : null,
    });
    const ap = u.accountProfile;
    return {
      ...base,
      addressLine1: ap?.addressLine1 ?? null,
      addressLine2: ap?.addressLine2 ?? null,
      state: ap?.state ?? null,
      postalCode: ap?.postalCode ?? null,
      country: ap?.country ?? null,
      workEmail: ap?.workEmail ?? null,
      workEmailVerified: ap?.workEmailVerified ?? false,
      registrationNumber: ap?.registrationNumber ?? null,
      website: ap?.website ?? null,
      projectCount: u._count.projects,
      isStaff: Boolean(u.adminProfile),
      staffLevel: (u.adminProfile?.staffLevel as StaffLevel | undefined) ?? null,
    };
  }

  private async requireSuperAdmin(subject: string): Promise<void> {
    const ctx = await this.staffContext.getBySubject(subject);
    if (!ctx || ctx.staffLevel !== 'super_admin') {
      throw new ForbiddenException('Super admin access required');
    }
  }

  /** Confirm the signed-in staff member knows their password before sensitive actions. */
  private async assertActorPassword(subject: string, password: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { authSubject: subject },
    });
    if (!user) {
      throw new UnauthorizedException('Could not verify your staff account.');
    }

    const email = normalizeEmail(user.email);
    const superEmail = normalizeEmail(this.config.get<string>('SUPER_ADMIN_EMAIL') ?? '');
    const superPassword = this.config.get<string>('SUPER_ADMIN_PASSWORD') ?? '';
    if (superEmail && superPassword && email === superEmail && password === superPassword) {
      return;
    }

    try {
      await this.identity.login(email, password);
      return;
    } catch {
      if (verifyPassword(password, user.passwordVerifier)) return;
      throw new UnauthorizedException(
        'Incorrect password. Enter your super admin password to confirm this action.',
      );
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

function toClientProjectSummary(p: {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
  matches: Array<{
    status: string;
    surveyor: { id: string; user: { fullName: string } };
  }>;
}): AdminClientProjectSummary {
  return {
    id: p.id,
    title: p.title,
    status: p.status as ProjectStatus,
    createdAt: p.createdAt.toISOString(),
    assignedSurveyor: pickAssignedSurveyor(p.matches),
  };
}

function pickAssignedSurveyor(
  matches: Array<{ status: string; surveyor: { id: string; user: { fullName: string } } }>,
): AdminClientProjectSummary['assignedSurveyor'] {
  if (!matches.length) return null;
  const rank: Record<string, number> = {
    accepted: 0,
    completed: 1,
    proposed: 2,
  };
  const sorted = [...matches].sort(
    (a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9),
  );
  const top = sorted[0];
  if (!top) return null;
  return { profileId: top.surveyor.id, fullName: top.surveyor.user.fullName };
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

function locationLabel(parts: Array<string | null | undefined>): string {
  const cleaned = parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  return cleaned.length > 0 ? cleaned.join(', ') : 'Unknown';
}

function locationLabelFromText(text: string | null | undefined): string {
  const raw = text?.trim();
  if (!raw) return 'Unknown';
  const first = raw.split(',').map((p) => p.trim()).filter(Boolean)[0];
  return first || raw;
}

function startOfUtcDay(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

function endOfUtcDay(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T23:59:59.999Z`);
}
