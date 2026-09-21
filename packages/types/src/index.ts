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

/** How the account signed up: as a company or as an individual. */
export const ACCOUNT_TYPES = ['individual', 'company'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * Marketplace post-signup onboarding gate (client + surveyor).
 * select_account_type → accept_terms (T&C + NDA) → verify_contact → complete_profile → portfolio (surveyor) → done
 */
export const ONBOARDING_STEPS = [
  'select_account_type',
  'accept_terms',
  'verify_contact',
  'complete_profile',
  'portfolio',
  'done',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Structured postal address (company address or individual base address). */
export interface PostalAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

/** Snapshot of where the user is in post-signup onboarding. */
export interface OnboardingStatus {
  step: OnboardingStep;
  /** Company accounts collect work email + company details; individuals collect a base address. */
  accountType: AccountType;
  /** False until the user picks individual vs company on the first onboarding screen. */
  accountTypeSelected: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Current phone on the account (E.164). */
  phone: string;
  /** True when the user should enter or confirm their number before SMS OTP. */
  phoneNeedsEntry: boolean;
  /** Terms & Conditions accepted — required before onboarding may proceed. */
  termsAccepted: boolean;
  /** NDA accepted — required before onboarding may proceed. */
  ndaAccepted: boolean;
  /** Both email and phone OTP verified — unlocks personal profile. */
  canCompleteProfile: boolean;
  /** Remaining contact channel still needs OTP (if any). Both are required. */
  pendingContact: 'email' | 'phone' | 'both' | 'none';
  /** Surveyors must finish portfolio after personal profile; clients skip. */
  requiresPortfolio: boolean;
  avatarKey: string | null;
  fullName: string;
  companyName: string | null;
  /** Company address (company) or base address (individual). */
  address: PostalAddress;
  /** Company-only: corporate email that requires its own OTP verification. */
  workEmail: string | null;
  workEmailVerified: boolean;
  registrationNumber: string | null;
  website: string | null;
}

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
  'users:view',
  'users:manage',
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
  viewer: ['clients:view', 'surveyors:view', 'projects:view', 'users:view'],
  matcher: [
    'clients:view',
    'surveyors:view',
    'projects:view',
    'users:view',
    'match:create',
    'match:update',
    'project:update_status',
  ],
  full: [
    'clients:view',
    'surveyors:view',
    'projects:view',
    'users:view',
    'users:manage',
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
  'users:view': 'View users',
  'users:manage': 'Edit & delete users',
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
  firstName: string;
  lastName: string;
  /** Unique public handle shown to other marketplace users. */
  username: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  avatarKey: string | null;
  onboardingStep: OnboardingStep;
  /** Company vs individual — chosen at signup. */
  accountType: AccountType;
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
  /** Pending portal invite awaiting first sign-in (token still valid). */
  invitePending: boolean;
  inviteExpiresAt: string | null;
  inviteAcceptedAt: string | null;
}

/** Public peek of a staff portal invite link (`GET /admin/staff/invite/:token`). */
export type StaffInvitePeek =
  | {
      ok: true;
      email: string;
      password: string;
      fullName: string;
      expiresAt: string;
    }
  | { ok: false; reason: string };

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

/**
 * Returned when Create account attaches a second marketplace role to an
 * existing identity (same email) instead of creating a new user.
 */
export interface SignupAccountNotice {
  kind: 'role_added';
  existingRole: WorkspaceRole;
  addedRole: WorkspaceRole;
  /** Professional copy for the client UI. */
  message: string;
}

/** Result of password signup — session is issued so OTP screens can run authenticated. */
export interface SignupResult {
  session: AuthSession;
  user: AuthenticatedUser;
  /** Present when signup linked a new role onto an existing account. */
  accountNotice?: SignupAccountNotice;
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
export interface AdminClientProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  createdAt: string;
  assignedSurveyor: {
    profileId: string;
    fullName: string;
  } | null;
}

export interface AdminClient {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string | null;
  city: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  projectCount: number;
  /** Latest projects for the listing card (limited). */
  recentProjects: AdminClientProjectSummary[];
  createdAt: string;
}

/** Full client dossier for admin detail view. */
export interface AdminClientDetail {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  accountType: string;
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
  projectCount: number;
  projects: AdminClientProjectSummary[];
  createdAt: string;
}

/** Marketplace / account directory row for the admin Users module. */
export interface AdminUser {
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
  status: UserStatus;
  roles: MembershipRole[];
  onboardingStep: string;
  authProvider: string | null;
  companyName: string | null;
  city: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full user record for admin view / edit. */
export interface AdminUserDetail extends AdminUser {
  addressLine1: string | null;
  addressLine2: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  workEmail: string | null;
  workEmailVerified: boolean;
  registrationNumber: string | null;
  website: string | null;
  projectCount: number;
  isStaff: boolean;
  staffLevel: StaffLevel | null;
}

export interface AdminQueueProject {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  services: SurveyService[];
  locationText: string | null;
  status: ProjectStatus;
  assignedSurveyor: {
    profileId: string;
    fullName: string;
  } | null;
  createdAt: string;
}

/** Lightweight, permission-free snapshot shown on the Operations overview. */
export interface AdminQueues {
  counts: { users: number; surveyors: number; openProjects: number };
}

/** Filtered operations overview analytics (still permission-free counts only). */
export interface AdminOverviewStats {
  filters: {
    from: string | null;
    to: string | null;
    location: string | null;
  };
  /** Current system totals (optionally narrowed by location). */
  totals: {
    clients: number;
    surveyors: number;
    matchableSurveyors: number;
    projects: number;
    openProjects: number;
    /** Surveyors with 100% portfolio completion. */
    completeSurveyors: number;
  };
  /** New records created inside the selected date window. */
  period: {
    clientsAdded: number;
    surveyorsAdded: number;
    projectsPosted: number;
    feedbackSubmitted: number;
  };
  /** Marketplace feedback aggregates (optionally narrowed by date). */
  feedback: {
    total: number;
    averageRating: number | null;
    recommendYes: number;
    recommendNo: number;
    fromClients: number;
    fromSurveyors: number;
    ratingDistribution: { rating: number; count: number }[];
  };
  /** Ranked location buckets for the filtered set. */
  locations: Array<{
    label: string;
    clients: number;
    surveyors: number;
    projects: number;
  }>;
  /** Distinct location labels available for the filter dropdown. */
  availableLocations: string[];
  /**
   * Daily activity in the selected window (or last 30 days when unscoped).
   * Values are new records created that UTC day.
   */
  trend: Array<{
    date: string;
    clients: number;
    surveyors: number;
    projects: number;
  }>;
  /** How many surveyors offer / projects request each service. */
  services: Array<{
    service: SurveyService;
    surveyors: number;
    projects: number;
  }>;
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
  /** 0–100 portfolio completion (same rules as surveyor app). */
  completionPercent: number;
  profileComplete: boolean;
  bldVerified: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  emailVerified: boolean;
  phoneVerified: boolean;
  onboardingStep: string;
}

// --- Notifications ---

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  /** Relative app path or absolute URL for the toast / inbox CTA. */
  linkUrl: string | null;
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

export * from './surveyor-portfolio';
export * from './project-brief';

import type {
  EquipmentId,
  SurveyorPortfolioDetails,
  SurveyService,
} from './surveyor-portfolio';
import { emptyPortfolioDetails } from './surveyor-portfolio';
import { type ProjectDetails } from './project-brief';

/** Full surveyor dossier for admin detail view. */
export interface AdminSurveyorDetail extends AdminSurveyor {
  bio: string | null;
  details: SurveyorPortfolioDetails;
  /** Completion checklist keys still missing (empty when complete). */
  missingChecks: string[];
}

/** A portfolio image; DB stores the public S3 HTTPS URL in `key`. */
export interface PortfolioItem {
  key: string;
  caption?: string;
}

export interface SurveyorProfile {
  id: string;
  userId: string;
  bio: string | null;
  services: SurveyService[];
  /** Selected equipment catalog IDs (and any legacy free-text entries). */
  equipment: string[];
  /** Base location in WGS84, or null if not set. */
  location: GeoPoint | null;
  baseCity: string | null;
  radiusKm: number;
  /** Day rate in integer cents (never float). */
  dayRateCents: number | null;
  portfolio: PortfolioItem[];
  /** Extended Core + Identity portfolio payload. */
  details: SurveyorPortfolioDetails;
  isMatchable: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Fields that count toward surveyor profile completion (%). */
export const SURVEYOR_PROFILE_COMPLETION_CHECKS = [
  { key: 'services', label: 'Services offered' },
  { key: 'baseCity', label: 'Base location' },
  { key: 'location', label: 'Map location' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'availability', label: 'Availability' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'yearsRealityCapture', label: 'Years of reality capture' },
  { key: 'industries', label: 'Industries' },
  { key: 'generalLiabilityInsurance', label: 'General liability insurance' },
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
  details?: SurveyorPortfolioDetails | null;
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

  const details = profile.details ?? emptyPortfolioDetails();
  const hasPricing =
    (profile.dayRateCents != null && profile.dayRateCents > 0) ||
    (details.hourlyRateCents != null && details.hourlyRateCents > 0);

  const checks: Record<SurveyorProfileCompletionKey, boolean> = {
    services: (profile.services?.length ?? 0) > 0,
    baseCity:
      Boolean(profile.baseCity?.trim()) ||
      (details.coverageCounties?.some((c) => c.selected !== false) ?? false),
    location:
      Boolean(profile.location) ||
      (details.coverageCounties?.some((c) => c.selected !== false) ?? false),
    equipment: (profile.equipment?.length ?? 0) > 0,
    availability: Boolean(details.availability),
    pricing: hasPricing,
    yearsRealityCapture:
      details.yearsRealityCapture != null && details.yearsRealityCapture >= 0,
    industries: details.industries.length > 0,
    generalLiabilityInsurance: typeof details.generalLiabilityInsurance === 'boolean',
  };

  const done = SURVEYOR_PROFILE_COMPLETION_CHECKS.filter((c) => checks[c.key]).map((c) => c.key);
  const missing = SURVEYOR_PROFILE_COMPLETION_CHECKS.filter((c) => !checks[c.key]).map((c) => c.key);
  const percent = Math.round((done.length / SURVEYOR_PROFILE_COMPLETION_CHECKS.length) * 100);

  return { percent, complete: missing.length === 0, done, missing };
}

/** @deprecated Prefer EquipmentId catalog; kept for typing helpers. */
export type LegacyEquipment = EquipmentId | string;

export interface SurveyorStatusMatch {
  matchId: string;
  status: MatchStatus;
  projectTitle: string;
  createdAt: string;
}

/**
 * A proposed match as seen by the surveyor, with full project details so they
 * can make an informed accept/decline decision.
 */
export interface SurveyorRequest {
  matchId: string;
  status: MatchStatus;
  createdAt: string;
  /** Absolute end of the working-hours response window. */
  expiresAt: string | null;
  /** Remaining business-time ms until expiresAt (pauses outside official hours). */
  remainingWorkingMs: number | null;
  /** True when the accept timer is paused (outside Mon–Fri work hours). */
  responseWindowPaused: boolean;
  offerSource: 'admin' | 'auto';
  project: {
    id: string;
    title: string;
    services: SurveyService[];
    location: GeoPoint | null;
    locationText: string | null;
    /** Great-circle km from the surveyor's base pin to the project site. */
    distanceKm: number | null;
    buildingType: string | null;
    buildingAge: string | null;
    floors: number | null;
    areaSqft: number | null;
    neededWithin: string | null;
    notes: string | null;
    status: ProjectStatus;
    createdAt: string;
  };
  client: {
    /** Public handle — never the client's legal name. */
    username: string;
    companyName: string | null;
  };
  /** Surveyor already left feedback for this match. */
  feedbackSubmitted?: boolean;
  /** Surveyor may leave feedback (completed engagement). */
  canLeaveFeedback?: boolean;
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
  /** Extended brief from the posting wizard. */
  details: ProjectDetails;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

/** Match summary on a project. Admin UIs may also show surveyor legal name. */
export interface ProjectMatchInfo {
  matchId: string;
  status: MatchStatus;
  surveyorBaseCity: string | null;
  surveyorProfileId: string | null;
  /** Public handle for marketplace peers. */
  surveyorUsername: string | null;
  /** Legal name — only populated for admin callers. */
  surveyorFullName: string | null;
  createdAt: string;
  /** Current viewer already left feedback for this match. */
  feedbackSubmitted?: boolean;
  /** Viewer may leave feedback (completed engagement). */
  canLeaveFeedback?: boolean;
}

export interface ProjectDetail extends Project {
  matches: ProjectMatchInfo[];
  /** Present on admin project workspace responses. */
  clientName?: string | null;
  /** Public client handle when available. */
  clientUsername?: string | null;
}

/** Client-facing surveyor card when browsing talent for a project. */
export interface ClientSurveyorSummary {
  profileId: string;
  /** Public handle — never the surveyor's legal name. */
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  baseCity: string | null;
  services: SurveyService[];
  equipment: string[];
  radiusKm: number;
  dayRateCents: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  bldVerified: boolean;
  /** Distance from the project site in km, when both points exist. */
  distanceKm: number | null;
  /** 0–100 relevance score used for default ranking. */
  relevanceScore: number;
}

export type ClientSurveyorSort =
  | 'relevance'
  | 'distance'
  | 'rating'
  | 'price_asc'
  | 'price_desc';

export interface ClientSurveyorPage {
  items: ClientSurveyorSummary[];
  nextCursor: string | null;
  total: number;
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
        headline: "We're finding the best surveyor for you",
        subtext: 'BLD is matching your brief to vetted surveyors nearby — hang tight.',
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
        subtext: 'Thanks for using BLD. Share a quick rating — it helps the network stay trusted.',
      };
    case 'cancelled':
      return {
        headline: 'This project was cancelled',
        subtext: 'If this was a mistake, post a new project and we\u2019ll pick things back up.',
      };
  }
}

// --- Feedback & ratings ---

export const FEEDBACK_ROLES = ['client', 'surveyor'] as const;
export type FeedbackRole = (typeof FEEDBACK_ROLES)[number];

export const FEEDBACK_ASPECT_KEYS = [
  'product',
  'partnership',
  'matching',
  'reliability',
] as const;
export type FeedbackAspectKey = (typeof FEEDBACK_ASPECT_KEYS)[number];

/** Default / admin labels — product & service quality, not person-to-person. */
export const FEEDBACK_ASPECT_LABELS: Record<FeedbackAspectKey, string> = {
  product: 'Overall product',
  partnership: 'Job tools & workflow',
  matching: 'Matching & assignment',
  reliability: 'Support & reliability',
};

/** Role-aware service labels (same product, different lens). */
export function feedbackAspectLabel(
  key: FeedbackAspectKey,
  role: FeedbackRole,
): string {
  if (key === 'partnership') {
    return role === 'client' ? 'Posting & managing jobs' : 'Finding & managing jobs';
  }
  if (key === 'matching') {
    return role === 'client' ? 'Getting matched to surveyors' : 'Getting matched to work';
  }
  return FEEDBACK_ASPECT_LABELS[key];
}

export type FeedbackAspects = Partial<Record<FeedbackAspectKey, number>>;

/** Overall 1–5 mapped to emoji labels for the rating UI. */
export const FEEDBACK_RATING_EMOJIS: Record<
  1 | 2 | 3 | 4 | 5,
  { emoji: string; label: string }
> = {
  1: { emoji: '😠', label: 'Poor' },
  2: { emoji: '😕', label: 'Fair' },
  3: { emoji: '😐', label: 'Okay' },
  4: { emoji: '🙂', label: 'Good' },
  5: { emoji: '🤩', label: 'Excellent' },
};

export function feedbackRatingEmoji(rating: number): string {
  if (rating >= 1 && rating <= 5) {
    return FEEDBACK_RATING_EMOJIS[rating as 1 | 2 | 3 | 4 | 5].emoji;
  }
  return '⭐';
}

export interface Feedback {
  id: string;
  matchId: string;
  projectId: string;
  projectTitle: string;
  fromUserId: string;
  fromUsername: string | null;
  fromFullName: string | null;
  fromRole: FeedbackRole;
  toUserId: string;
  toUsername: string | null;
  toFullName: string | null;
  rating: number;
  comment: string;
  aspects: FeedbackAspects;
  recommend: boolean | null;
  createdAt: string;
}

export interface FeedbackSubmitResult {
  feedback: Feedback;
  message: string;
}

/** Public landing / marketing site feedback (no auth, no match). */
export interface SiteFeedback {
  id: string;
  name: string | null;
  email: string | null;
  rating: number;
  message: string;
  source: string;
  createdAt: string;
}

export interface SiteFeedbackSubmitResult {
  feedback: SiteFeedback;
  message: string;
}

// --- Activity timeline (date-wise ops visibility) ---

export const ACTIVITY_ENTITY_TYPES = [
  'project',
  'match',
  'help_ticket',
  'feedback',
] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export interface ActivityLogEntry {
  id: string;
  entityType: ActivityEntityType;
  entityId: string;
  projectId: string | null;
  matchId: string | null;
  helpTicketId: string | null;
  action: string;
  summary: string;
  actorUserId: string | null;
  actorFullName: string | null;
  actorUsername: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

// --- Help desk ---

export const HELP_TICKET_WORKSPACES = ['client', 'surveyor'] as const;
export type HelpTicketWorkspace = (typeof HELP_TICKET_WORKSPACES)[number];

export const HELP_TICKET_CATEGORIES = [
  'blocker',
  'account',
  'billing',
  'project',
  'matching',
  'technical',
  'other',
] as const;
export type HelpTicketCategory = (typeof HELP_TICKET_CATEGORIES)[number];

export const HELP_TICKET_CATEGORY_LABELS: Record<HelpTicketCategory, string> = {
  blocker: 'Blocker — can’t proceed',
  account: 'Account & login',
  billing: 'Billing',
  project: 'Project brief',
  matching: 'Matching & surveyors',
  technical: 'Technical issue',
  other: 'Other',
};

export const HELP_TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type HelpTicketPriority = (typeof HELP_TICKET_PRIORITIES)[number];

export const HELP_TICKET_PRIORITY_LABELS: Record<HelpTicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const HELP_TICKET_STATUSES = [
  'open',
  'in_progress',
  'waiting',
  'resolved',
  'closed',
] as const;
export type HelpTicketStatus = (typeof HELP_TICKET_STATUSES)[number];

export const HELP_TICKET_STATUS_LABELS: Record<HelpTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting: 'Waiting on user',
  resolved: 'Resolved',
  closed: 'Closed',
};

export interface HelpTicketAttachment {
  url: string;
  fileName: string;
  contentType?: string | null;
}

export interface HelpTicketMessage {
  id: string;
  body: string;
  attachments: HelpTicketAttachment[];
  isStaff: boolean;
  authorUsername: string | null;
  authorFullName: string | null;
  createdAt: string;
}

export interface HelpTicket {
  id: string;
  ticketNumber: string;
  workspace: HelpTicketWorkspace;
  category: HelpTicketCategory;
  priority: HelpTicketPriority;
  subject: string;
  status: HelpTicketStatus;
  projectId: string | null;
  requesterUsername: string | null;
  requesterFullName: string | null;
  requesterEmail: string | null;
  assignedToFullName: string | null;
  messageCount: number;
  latestMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface HelpTicketDetail extends HelpTicket {
  messages: HelpTicketMessage[];
}
