/**
 * Shared SurveyLink domain types (Phase 1).
 *
 * These mirror the CHECK-constrained status columns in the database and act as
 * the single source of truth for state-machine values across web, mobile, and API.
 */

// --- Users ---

export const ROLE_HINTS = ['client', 'surveyor', 'both'] as const;
export type RoleHint = (typeof ROLE_HINTS)[number];

/** Marketplace + staff memberships stored in `user_roles`. */
export const MEMBERSHIP_ROLES = ['client', 'surveyor', 'admin'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/** Roles selectable on public login / signup (not admin). */
export const WORKSPACE_ROLES = ['client', 'surveyor'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

// --- Projects ---

export const PROJECT_STATUSES = [
  'submitted',
  'matching',
  'matched',
  'confirmed',
  'completed',
  'cancelled',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/**
 * Allowed project status transitions (Phase 1).
 * `cancelled` is reachable from any non-terminal state. Only the admin advances
 * the pipeline; transitions are enforced in the backend, not just the UI.
 */
export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  submitted: ['matching', 'cancelled'],
  matching: ['matched', 'cancelled'],
  matched: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// --- Matches ---

export const MATCH_STATUSES = [
  'proposed',
  'accepted',
  'declined',
  'completed',
  'cancelled',
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_STATUS_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  proposed: ['accepted', 'declined', 'cancelled'],
  accepted: ['completed', 'cancelled'],
  declined: [],
  completed: [],
  cancelled: [],
};

// --- Notifications ---

export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// --- Auth ---

/** Platform-staff role, carried as a custom claim in the access token. */
export const APP_ROLES = ['admin'] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Staff tier within the admin membership. */
export const STAFF_LEVELS = ['super_admin', 'admin'] as const;
export type StaffLevel = (typeof STAFF_LEVELS)[number];

/** Fine-grained staff actions (super_admin has all implicitly). */
export const STAFF_PERMISSIONS = [
  'clients:view',
  'surveyors:view',
  'projects:view',
  'match:create',
  'match:update',
  'project:update_status',
  'staff:manage',
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

/** Named presets; `custom` means the stored permissions array is authoritative. */
export const STAFF_PERMISSION_PRESETS = ['viewer', 'matcher', 'full', 'custom'] as const;
export type StaffPermissionPreset = (typeof STAFF_PERMISSION_PRESETS)[number];

export const STAFF_PERMISSION_PRESET_MAP: Record<
  Exclude<StaffPermissionPreset, 'custom'>,
  StaffPermission[]
> = {
  viewer: ['clients:view', 'surveyors:view', 'projects:view'],
  matcher: [
    'clients:view',
    'surveyors:view',
    'projects:view',
    'match:create',
    'match:update',
    'project:update_status',
  ],
  full: [
    'clients:view',
    'surveyors:view',
    'projects:view',
    'match:create',
    'match:update',
    'project:update_status',
  ],
};

export const STAFF_PERMISSION_LABELS: Record<StaffPermission, string> = {
  'clients:view': 'View clients',
  'surveyors:view': 'View surveyors',
  'projects:view': 'View projects queue',
  'match:create': 'Create matches',
  'match:update': 'Update matches',
  'project:update_status': 'Update project status',
  'staff:manage': 'Manage staff admins',
};

/** Legacy permission ids still stored on older admin profiles. */
const LEGACY_PERMISSION_MAP: Record<string, StaffPermission> = {
  'queue:view': 'projects:view',
};

export function resolveStaffPermissions(input: {
  staffLevel: StaffLevel | null | undefined;
  permissionPreset?: StaffPermissionPreset | null;
  permissions?: readonly string[] | null;
}): StaffPermission[] {
  if (input.staffLevel === 'super_admin') {
    return [...STAFF_PERMISSIONS];
  }
  if (!input.staffLevel) return [];
  const preset = input.permissionPreset ?? 'matcher';
  if (preset === 'custom') {
    const normalized = (input.permissions ?? [])
      .map((p) => LEGACY_PERMISSION_MAP[p] ?? p)
      .filter((p): p is StaffPermission =>
        (STAFF_PERMISSIONS as readonly string[]).includes(p),
      );
    return Array.from(new Set(normalized));
  }
  return [...STAFF_PERMISSION_PRESET_MAP[preset]];
}

/**
 * The authenticated principal decoded from a validated Auth0 access token and
 * attached to each request. `sub` is the provider subject (Auth0 user_id),
 * which maps to `users.auth_subject`.
 */
export interface AuthPrincipal {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  roles: AppRole[];
}

/** Shape returned by `GET /auth/me`. */
export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  /** @deprecated Derived from memberships for older clients. */
  roleHint: RoleHint;
  /** Segregated role memberships (client / surveyor / admin). */
  memberships: MembershipRole[];
  status: UserStatus;
  roles: AppRole[];
  /** Present when the user has an admin membership. */
  staffLevel?: StaffLevel | null;
  /** Effective permissions for staff UI/API gating. */
  permissions?: StaffPermission[];
  permissionPreset?: StaffPermissionPreset | null;
}

/** Staff member row for super-admin management UI. */
export interface StaffAdmin {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: UserStatus;
  staffLevel: StaffLevel;
  permissionPreset: StaffPermissionPreset;
  permissions: StaffPermission[];
  title: string | null;
  createdAt: string;
}

/** Token bundle returned by `POST /auth/login`. */
export interface AuthSession {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  /** Workspace chosen at login (client or surveyor). */
  activeRole?: WorkspaceRole;
}

/** Minimal profile resolved from a social login, used to prefill signup. */
export interface OAuthProfile {
  email: string;
  fullName: string;
}

/**
 * Result of exchanging a Google authorization code. When `registered` is false
 * no local account exists yet: the client is authenticated (session is valid)
 * but must complete registration (phone + role) before using the app.
 */
export interface GoogleAuthResult {
  session: AuthSession;
  registered: boolean;
  roleHint: RoleHint;
  profile: OAuthProfile;
}

// --- Admin & matches ---

export interface Match {
  id: string;
  projectId: string;
  surveyorId: string;
  matchedBy: string;
  status: MatchStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Client directory row for the admin Clients module. */
export interface AdminClient {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  projectCount: number;
  createdAt: string;
}

export interface AdminQueueProject {
  id: string;
  title: string;
  clientName: string;
  services: SurveyService[];
  locationText: string | null;
  status: ProjectStatus;
  createdAt: string;
}

/** Lightweight, permission-free snapshot shown on the Operations overview. */
export interface AdminQueues {
  counts: { users: number; surveyors: number; openProjects: number };
}

/** A surveyor as seen in the admin browser, with optional distance to a point. */
export interface AdminSurveyor {
  profileId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  baseCity: string | null;
  services: SurveyService[];
  equipment: string[];
  radiusKm: number;
  dayRateCents: number | null;
  isMatchable: boolean;
  location: GeoPoint | null;
  /** Distance in km from the `near` point, if one was supplied. */
  distanceKm: number | null;
  createdAt: string;
}

// --- Notifications ---

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  channel: NotificationChannel;
  readAt: string | null;
  createdAt: string;
}

// --- Geo ---

export interface GeoPoint {
  /** Longitude, WGS84 (EPSG:4326). */
  lng: number;
  /** Latitude, WGS84 (EPSG:4326). */
  lat: number;
}

// --- Health ---

export interface HealthStatus {
  status: 'ok' | 'error';
  info?: Record<string, { status: 'up' | 'down' }>;
  uptimeSeconds: number;
  timestamp: string;
}

export function isValidTransition<T extends string>(
  transitions: Record<T, T[]>,
  from: T,
  to: T,
): boolean {
  return transitions[from]?.includes(to) ?? false;
}

// --- Surveyor domain ---

export const SURVEY_SERVICES = [
  'laser_scanning',
  'drone',
  'topographic',
  'measured_building',
  'land',
  'scan_to_bim',
] as const;
export type SurveyService = (typeof SURVEY_SERVICES)[number];

export const SURVEY_SERVICE_LABELS: Record<SurveyService, string> = {
  laser_scanning: 'Laser scanning',
  drone: 'Drone',
  topographic: 'Topographic',
  measured_building: 'Measured building',
  land: 'Land',
  scan_to_bim: 'Scan-to-BIM',
};

/** A portfolio image; DB stores only the object-storage key (S3), not a URL. */
export interface PortfolioItem {
  key: string;
  caption?: string;
}

export interface SurveyorProfile {
  id: string;
  userId: string;
  bio: string | null;
  services: SurveyService[];
  equipment: string[];
  /** Base location in WGS84, or null if not set. */
  location: GeoPoint | null;
  baseCity: string | null;
  radiusKm: number;
  /** Day rate in integer cents (never float). */
  dayRateCents: number | null;
  portfolio: PortfolioItem[];
  isMatchable: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Fields that count toward surveyor profile completion (%). */
export const SURVEYOR_PROFILE_COMPLETION_CHECKS = [
  { key: 'services', label: 'Services offered' },
  { key: 'baseCity', label: 'Base city' },
  { key: 'location', label: 'Map location' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'bio', label: 'Bio' },
  { key: 'dayRate', label: 'Day rate' },
] as const;

export type SurveyorProfileCompletionKey =
  (typeof SURVEYOR_PROFILE_COMPLETION_CHECKS)[number]['key'];

export interface SurveyorProfileCompletion {
  percent: number;
  complete: boolean;
  done: SurveyorProfileCompletionKey[];
  missing: SurveyorProfileCompletionKey[];
}

type ProfileCompletionSource = {
  services?: SurveyService[] | null;
  equipment?: string[] | null;
  bio?: string | null;
  baseCity?: string | null;
  location?: GeoPoint | null;
  dayRateCents?: number | null;
};

export function surveyorProfileCompletion(
  profile: ProfileCompletionSource | null | undefined,
): SurveyorProfileCompletion {
  if (!profile) {
    return {
      percent: 0,
      complete: false,
      done: [],
      missing: SURVEYOR_PROFILE_COMPLETION_CHECKS.map((c) => c.key),
    };
  }

  const checks: Record<SurveyorProfileCompletionKey, boolean> = {
    services: (profile.services?.length ?? 0) > 0,
    baseCity: Boolean(profile.baseCity?.trim()),
    location: Boolean(profile.location),
    equipment: (profile.equipment?.length ?? 0) > 0,
    bio: Boolean(profile.bio?.trim()),
    dayRate: profile.dayRateCents != null && profile.dayRateCents > 0,
  };

  const done = SURVEYOR_PROFILE_COMPLETION_CHECKS.filter((c) => checks[c.key]).map((c) => c.key);
  const missing = SURVEYOR_PROFILE_COMPLETION_CHECKS.filter((c) => !checks[c.key]).map((c) => c.key);
  const percent = Math.round((done.length / SURVEYOR_PROFILE_COMPLETION_CHECKS.length) * 100);

  return { percent, complete: missing.length === 0, done, missing };
}

export interface SurveyorStatusMatch {
  matchId: string;
  status: MatchStatus;
  projectTitle: string;
  createdAt: string;
}

/**
 * Drives the surveyor dashboard. `headline` is the polished status message;
 * `completionPercent` gates Dashboard access until the profile is finished.
 */
export interface SurveyorStatus {
  hasProfile: boolean;
  /**
   * Effective "live for matches" flag used by the dashboard and match pipeline.
   * Only true when the DB preference is on AND the profile is 100% complete.
   */
  isMatchable: boolean;
  /** Raw toggle preference stored on the surveyor profile (independent of completion). */
  matchablePreference: boolean;
  headline: string;
  subtext: string;
  matches: SurveyorStatusMatch[];
  /** 0–100 profile completion used for nav gating and progress UI. */
  completionPercent: number;
  profileComplete: boolean;
}

// --- Client projects ---

export interface Project {
  id: string;
  clientId: string;
  title: string;
  services: SurveyService[];
  location: GeoPoint | null;
  locationText: string | null;
  buildingType: string | null;
  buildingAge: string | null;
  floors: number | null;
  areaSqft: number | null;
  neededWithin: string | null;
  notes: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

/** Non-PII match summary shown to the client on their project. */
export interface ProjectMatchInfo {
  matchId: string;
  status: MatchStatus;
  surveyorBaseCity: string | null;
  createdAt: string;
}

export interface ProjectDetail extends Project {
  matches: ProjectMatchInfo[];
}

/**
 * The client's signature status message, derived from project status. Only the
 * admin advances the pipeline; the client just sees where things stand.
 */
export function clientProjectHeadline(status: ProjectStatus): {
  headline: string;
  subtext: string;
} {
  switch (status) {
    case 'submitted':
    case 'matching':
      return {
        headline: "We're finding the right surveyor for you",
        subtext: 'Our team is reviewing your project and matching it to a vetted surveyor nearby.',
      };
    case 'matched':
      return {
        headline: "We've found a surveyor — we'll be in touch to confirm.",
        subtext: 'Expect a call or message shortly to confirm timing and details.',
      };
    case 'confirmed':
      return {
        headline: 'Your surveyor is confirmed',
        subtext: 'Everything is set. Your surveyor will coordinate the visit with you directly.',
      };
    case 'completed':
      return {
        headline: 'Survey complete',
        subtext: 'Thanks for using SurveyLink. We hope the results were exactly what you needed.',
      };
    case 'cancelled':
      return {
        headline: 'This project was cancelled',
        subtext: 'If this was a mistake, post a new project and we\u2019ll pick things back up.',
      };
  }
}
