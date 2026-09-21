import type {
  HealthStatus,
  AuthSession,
  AuthenticatedUser,
  GoogleAuthResult,
  OnboardingStatus,
  RoleHint,
  SignupResult,
  SurveyorProfile,
  SurveyorPortfolioDetails,
  SurveyorRequest,
  SurveyorStatus,
  SurveyService,
  GeoPoint,
  PortfolioItem,
  Project,
  ProjectDetail,
  ClientSurveyorPage,
  ClientSurveyorSort,
  AdminQueues,
  AdminOverviewStats,
  AdminSurveyor,
  AdminSurveyorDetail,
  AdminClient,
  AdminClientDetail,
  AdminUser,
  AdminUserDetail,
  Match,
  MatchStatus,
  ProjectStatus,
  Notification,
  StaffAdmin,
  StaffPermission,
  StaffPermissionPreset,
  UserStatus,
  AdminQueueProject,
  Feedback,
  FeedbackSubmitResult,
  SiteFeedback,
  SiteFeedbackSubmitResult,
  HelpTicket,
  HelpTicketDetail,
  HelpTicketCategory,
  HelpTicketPriority,
  HelpTicketStatus,
  HelpTicketWorkspace,
  ActivityLogEntry,
  ActivityEntityType,
} from '@surveylink/types';

export interface CreateProjectBody {
  title: string;
  services: SurveyService[];
  location?: GeoPoint;
  locationText?: string;
  buildingType?: string;
  buildingAge?: string;
  floors?: number;
  areaSqft?: number;
  neededWithin?: string;
  notes?: string;
  details?: Record<string, unknown>;
}

export interface SurveyorProfileBody {
  bio?: string;
  services: SurveyService[];
  equipment?: string[];
  location?: GeoPoint;
  baseCity?: string;
  radiusKm?: number;
  dayRateCents?: number;
  portfolio?: PortfolioItem[];
  details?: SurveyorPortfolioDetails;
  isMatchable?: boolean;
}

export interface SignupBody {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  roleHint?: 'client' | 'surveyor';
  accountType?: 'individual' | 'company';
}

/** Structured address collected during onboarding. */
export interface PostalAddressBody {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CompleteProfileBody {
  fullName?: string;
  avatarKey?: string | null;
  companyName?: string | null;
  address?: PostalAddressBody;
  registrationNumber?: string | null;
  website?: string | null;
}

export interface LoginBody {
  email: string;
  password: string;
  /** Marketplace workspace to enter. Omit for staff portal. */
  role?: 'client' | 'surveyor';
}

/** Marketplace forgot-password. Staff/admin accounts are not eligible. */
export interface ForgotPasswordBody {
  email: string;
  role: 'client' | 'surveyor';
}

export interface AddMembershipBody {
  role: 'client' | 'surveyor';
}

export interface GoogleExchangeBody {
  code: string;
  state: string;
  /** Must match the redirect used in googleStartUrl (mobile deep link). */
  redirectUri?: string;
}

export interface CompleteRegistrationBody {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  roleHint?: RoleHint;
  accountType?: 'individual' | 'company';
}

export interface AdminSurveyorQueryBody {
  service?: SurveyService;
  nearLat?: number;
  nearLng?: number;
  radiusKm?: number;
  q?: string;
  city?: string;
  matchable?: boolean;
  complete?: boolean;
  bldVerified?: boolean;
  minRating?: number;
  minDayRateCents?: number;
  maxDayRateCents?: number;
}

export interface AdminOverviewQueryBody {
  from?: string;
  to?: string;
  location?: string;
}

export interface AdminProjectsQueryBody {
  clientId?: string;
  /** pipeline = pending match only; all = every project */
  scope?: 'pipeline' | 'all';
}

export interface CreateMatchBody {
  projectId: string;
  surveyorId: string;
  notes?: string;
}

export interface UpdateMatchBody {
  status?: MatchStatus;
  adminNotes?: string;
}

export interface CreateStaffAdminBody {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  title?: string;
  permissionPreset?: StaffPermissionPreset;
  permissions?: StaffPermission[];
}

export interface UpdateStaffAdminBody {
  title?: string | null;
  permissionPreset?: StaffPermissionPreset;
  permissions?: StaffPermission[];
  status?: UserStatus;
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Optional bearer token / session accessor, resolved per-request. */
  getAuthToken?: () => string | undefined | Promise<string | undefined>;
  /**
   * Called when an authenticated request returns 401 (token was sent).
   * Use to clear session and send the user to sign-in. Not invoked for
   * unauthenticated calls (e.g. wrong password on login).
   */
  onUnauthorized?: () => void | Promise<void>;
  fetch?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Typed SurveyLink backend client shared by web and mobile.
 *
 * Phase 1 scaffold exposes only `health()`. Auth, profile, project, and admin
 * methods are added alongside their endpoints in later build steps.
 */
export class SurveyLinkClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    // Native fetch must keep its global `this`; binding avoids "Illegal
    // invocation" when it is invoked as a property of this client.
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async health(): Promise<HealthStatus> {
    return this.request<HealthStatus>('GET', '/health');
  }

  // --- Auth ---

  async signup(body: SignupBody): Promise<SignupResult> {
    return this.request<SignupResult>('POST', '/auth/signup', body);
  }

  async login(body: LoginBody): Promise<AuthSession> {
    return this.request<AuthSession>('POST', '/auth/login', body);
  }

  /** Send a password-reset email for a client or surveyor account. */
  async forgotPassword(body: ForgotPasswordBody): Promise<{ ok: true; message: string }> {
    return this.request<{ ok: true; message: string }>('POST', '/auth/forgot-password', body);
  }

  /** Peek a reset token (masked email) without consuming it. */
  async peekResetPassword(
    token: string,
  ): Promise<{ ok: true; emailMasked: string } | { ok: false; reason: string }> {
    const q = new URLSearchParams({ token });
    return this.request<{ ok: true; emailMasked: string } | { ok: false; reason: string }>(
      'GET',
      `/auth/reset-password?${q.toString()}`,
    );
  }

  /** Consume the reset token and set a new password for that user. */
  async resetPassword(body: { token: string; password: string }): Promise<{ ok: true }> {
    return this.request<{ ok: true }>('POST', '/auth/reset-password', body);
  }

  /** Resolve the "Continue with Google" URL to navigate the browser to. */
  async googleStartUrl(role?: RoleHint, redirectUri?: string): Promise<{ url: string }> {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (redirectUri) params.set('redirectUri', redirectUri);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ url: string }>('GET', `/auth/oauth/google/start${suffix}`);
  }

  /** Exchange the Google authorization code (from the callback) for a session. */
  async exchangeGoogle(body: GoogleExchangeBody): Promise<GoogleAuthResult> {
    return this.request<GoogleAuthResult>('POST', '/auth/oauth/google/exchange', body);
  }

  /** Finish a social sign-up by supplying phone + role (requires the session). */
  async completeRegistration(body: CompleteRegistrationBody): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('POST', '/auth/complete-registration', body);
  }

  /** Add a second marketplace workspace (client ↔ surveyor) to an existing account. */
  async addMembership(body: AddMembershipBody): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('POST', '/auth/memberships', body);
  }

  async logout(refreshToken?: string): Promise<void> {
    await this.request<void>('POST', '/auth/logout', { refreshToken });
  }

  async me(): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('GET', '/auth/me');
  }

  async updateMe(body: {
    fullName?: string;
    avatarKey?: string | null;
    companyName?: string | null;
    address?: {
      line1: string;
      line2?: string | null;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    registrationNumber?: string | null;
    website?: string | null;
  }): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('PATCH', '/auth/me', body);
  }

  async uploadAvatar(
    photo: Blob | { uri: string; name?: string; type?: string },
    filename = 'profile-photo',
  ): Promise<AuthenticatedUser> {
    const form = new FormData();
    if (typeof Blob !== 'undefined' && photo instanceof Blob) {
      form.append('photo', photo, filename);
    } else {
      const file = photo as { uri: string; name?: string; type?: string };
      // React Native FormData expects a file-shaped object, not a Blob.
      form.append('photo', {
        uri: file.uri,
        name: file.name ?? filename,
        type: file.type ?? 'image/jpeg',
      } as unknown as Blob);
    }
    return this.request<AuthenticatedUser>('POST', '/auth/me/avatar', form);
  }

  /**
   * Upload any media to S3. Returns the public HTTPS URL to store in the profile.
   * kind: avatar | portfolio | document | logo | cover | certificate
   */
  async uploadMedia(
    file: Blob | { uri: string; name?: string; type?: string },
    kind:
      | 'avatar'
      | 'portfolio'
      | 'document'
      | 'logo'
      | 'cover'
      | 'certificate' = 'portfolio',
    filename = 'upload',
  ): Promise<{
    url: string;
    signedUrl?: string;
    key: string;
    contentType: string;
    fileName: string;
  }> {
    const form = new FormData();
    form.append('kind', kind);
    if (typeof Blob !== 'undefined' && file instanceof Blob) {
      form.append('file', file, filename);
    } else {
      const asset = file as { uri: string; name?: string; type?: string };
      form.append('file', {
        uri: asset.uri,
        name: asset.name ?? filename,
        type: asset.type ?? 'image/jpeg',
      } as unknown as Blob);
    }
    return this.request('POST', '/media/upload', form);
  }

  /** Best-effort delete of a previously uploaded S3 object (by stable URL or key). */
  async deleteMedia(target: { url?: string; key?: string }): Promise<{ ok: true }> {
    return this.request<{ ok: true }>('DELETE', '/media', target);
  }

  async getOnboarding(): Promise<OnboardingStatus> {
    return this.request<OnboardingStatus>('GET', '/auth/onboarding');
  }

  /** First onboarding glance — choose company vs individual. */
  async selectAccountType(accountType: 'individual' | 'company'): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('POST', '/auth/onboarding/account-type', { accountType });
  }

  /** Middle acceptance step — records Terms & NDA acceptance (both required). */
  async acceptTerms(): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('POST', '/auth/onboarding/accept-terms', {
      acceptTerms: true,
      acceptNda: true,
    });
  }

  /** Company-only: send an OTP to the corporate work email. */
  async startWorkEmailVerification(workEmail: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>('POST', '/auth/onboarding/work-email/start', { workEmail });
  }

  /** Company-only: confirm the work email OTP. */
  async verifyWorkEmail(code: string): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('POST', '/auth/onboarding/work-email/verify', { code });
  }

  async completeProfile(body: CompleteProfileBody = {}): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('POST', '/auth/onboarding/complete-profile', body);
  }

  async completePortfolio(): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('POST', '/auth/onboarding/complete-portfolio', {});
  }

  async startEmailVerification(): Promise<{ ok: true }> {
    return this.request<{ ok: true }>('POST', '/auth/verify-email/start', {});
  }

  async verifyEmail(code: string): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('POST', '/auth/verify-email', { code });
  }

  async startPhoneVerification(phone?: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>('POST', '/auth/verify-phone/start', phone ? { phone } : {});
  }

  async verifyPhone(code: string): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('POST', '/auth/verify-phone', { code });
  }

  // --- Surveyor ---

  async createSurveyorProfile(body: SurveyorProfileBody): Promise<SurveyorProfile> {
    return this.request<SurveyorProfile>('POST', '/surveyor/profile', body);
  }

  async getSurveyorProfile(): Promise<SurveyorProfile> {
    return this.request<SurveyorProfile>('GET', '/surveyor/profile');
  }

  async updateSurveyorProfile(body: Partial<SurveyorProfileBody>): Promise<SurveyorProfile> {
    return this.request<SurveyorProfile>('PATCH', '/surveyor/profile', body);
  }

  async getSurveyorStatus(): Promise<SurveyorStatus> {
    return this.request<SurveyorStatus>('GET', '/surveyor/status');
  }

  async getSurveyorRequests(): Promise<SurveyorRequest[]> {
    return this.request<SurveyorRequest[]>('GET', '/surveyor/requests');
  }

  async getSurveyorMatches(): Promise<SurveyorRequest[]> {
    return this.request<SurveyorRequest[]>('GET', '/surveyor/matches');
  }

  async acceptMatch(matchId: string): Promise<{ matchId: string; status: string }> {
    return this.request<{ matchId: string; status: string }>('POST', `/surveyor/requests/${matchId}/accept`);
  }

  async declineMatch(matchId: string): Promise<{ matchId: string; status: string }> {
    return this.request<{ matchId: string; status: string }>('POST', `/surveyor/requests/${matchId}/decline`);
  }

  // --- Client projects ---

  async createProject(body: CreateProjectBody): Promise<Project> {
    return this.request<Project>('POST', '/projects', body);
  }

  async getProjects(): Promise<Project[]> {
    return this.request<Project[]>('GET', '/projects');
  }

  async getProject(id: string): Promise<ProjectDetail> {
    return this.request<ProjectDetail>('GET', `/projects/${id}`);
  }

  async browseProjectSurveyors(
    projectId: string,
    query: {
      cursor?: number | string;
      limit?: number;
      services?: SurveyService[];
      minRating?: number;
      bldVerified?: boolean;
      radiusKm?: number;
      minDayRateCents?: number;
      maxDayRateCents?: number;
      q?: string;
      sort?: ClientSurveyorSort;
    } = {},
  ): Promise<ClientSurveyorPage> {
    const params = new URLSearchParams();
    if (query.cursor != null) params.set('cursor', String(query.cursor));
    if (query.limit != null) params.set('limit', String(query.limit));
    if (query.minRating != null) params.set('minRating', String(query.minRating));
    if (query.bldVerified != null) params.set('bldVerified', String(query.bldVerified));
    if (query.radiusKm != null) params.set('radiusKm', String(query.radiusKm));
    if (query.minDayRateCents != null) params.set('minDayRateCents', String(query.minDayRateCents));
    if (query.maxDayRateCents != null) params.set('maxDayRateCents', String(query.maxDayRateCents));
    if (query.q) params.set('q', query.q);
    if (query.sort) params.set('sort', query.sort);
    for (const s of query.services ?? []) params.append('services', s);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request<ClientSurveyorPage>('GET', `/projects/${projectId}/surveyors${suffix}`);
  }

  // --- Notifications ---

  async getNotifications(): Promise<Notification[]> {
    return this.request<Notification[]>('GET', '/notifications');
  }

  async markNotificationRead(id: string): Promise<Notification> {
    return this.request<Notification>('PATCH', `/notifications/${id}/read`);
  }

  // --- Admin ---

  async getAdminQueues(): Promise<AdminQueues> {
    return this.request<AdminQueues>('GET', '/admin/queues');
  }

  async getAdminOverview(query: AdminOverviewQueryBody = {}): Promise<AdminOverviewStats> {
    const qs = new URLSearchParams();
    if (query.from) qs.set('from', query.from);
    if (query.to) qs.set('to', query.to);
    if (query.location) qs.set('location', query.location);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<AdminOverviewStats>('GET', `/admin/overview${suffix}`);
  }

  async listAdminClients(): Promise<AdminClient[]> {
    return this.request<AdminClient[]>('GET', '/admin/clients');
  }

  async getAdminClient(id: string): Promise<AdminClientDetail> {
    return this.request<AdminClientDetail>('GET', `/admin/clients/${id}`);
  }

  async listAdminUsers(query: {
    q?: string;
    role?: 'client' | 'surveyor' | 'admin';
    status?: 'active' | 'suspended';
  } = {}): Promise<AdminUser[]> {
    const qs = new URLSearchParams();
    if (query.q) qs.set('q', query.q);
    if (query.role) qs.set('role', query.role);
    if (query.status) qs.set('status', query.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<AdminUser[]>('GET', `/admin/users${suffix}`);
  }

  async getAdminUser(id: string): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>('GET', `/admin/users/${id}`);
  }

  async updateAdminUser(
    id: string,
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      status?: 'active' | 'suspended';
      accountType?: 'individual' | 'company';
      companyName?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
      workEmail?: string | null;
      website?: string | null;
      registrationNumber?: string | null;
    },
  ): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>('PATCH', `/admin/users/${id}`, body);
  }

  async deleteAdminUser(id: string): Promise<void> {
    await this.request<void>('DELETE', `/admin/users/${id}`);
  }

  /** Super admin only — re-auth with password, then mark email or phone verified. */
  async verifyAdminUserContact(
    id: string,
    body: { channel: 'email' | 'phone'; password: string },
  ): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>('POST', `/admin/users/${id}/verify-contact`, body);
  }

  async listAdminOpenProjects(query: AdminProjectsQueryBody = {}): Promise<AdminQueueProject[]> {
    const qs = new URLSearchParams();
    if (query.clientId) qs.set('clientId', query.clientId);
    // Pipeline = pending match only. Prefer explicit path over scope query.
    const scope = query.scope ?? 'pipeline';
    if (scope === 'all') {
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return this.request<AdminQueueProject[]>('GET', `/admin/projects${suffix}`);
    }
    qs.set('scope', 'pipeline');
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<AdminQueueProject[]>('GET', `/admin/projects/open${suffix}`);
  }

  /** All projects (any status). */
  async listAdminProjects(query: { clientId?: string } = {}): Promise<AdminQueueProject[]> {
    return this.listAdminOpenProjects({ ...query, scope: 'all' });
  }

  async browseAdminSurveyors(query: AdminSurveyorQueryBody = {}): Promise<AdminSurveyor[]> {
    const qs = new URLSearchParams();
    if (query.service) qs.set('service', query.service);
    if (query.nearLat != null) qs.set('nearLat', String(query.nearLat));
    if (query.nearLng != null) qs.set('nearLng', String(query.nearLng));
    if (query.radiusKm != null) qs.set('radiusKm', String(query.radiusKm));
    if (query.q) qs.set('q', query.q);
    if (query.city) qs.set('city', query.city);
    if (query.matchable !== undefined) qs.set('matchable', String(query.matchable));
    if (query.complete !== undefined) qs.set('complete', String(query.complete));
    if (query.bldVerified !== undefined) qs.set('bldVerified', String(query.bldVerified));
    if (query.minRating != null) qs.set('minRating', String(query.minRating));
    if (query.minDayRateCents != null) qs.set('minDayRateCents', String(query.minDayRateCents));
    if (query.maxDayRateCents != null) qs.set('maxDayRateCents', String(query.maxDayRateCents));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<AdminSurveyor[]>('GET', `/admin/surveyors${suffix}`);
  }

  async getAdminSurveyor(id: string): Promise<AdminSurveyorDetail> {
    return this.request<AdminSurveyorDetail>('GET', `/admin/surveyors/${id}`);
  }

  async updateAdminSurveyor(
    id: string,
    body: Partial<SurveyorProfileBody>,
  ): Promise<AdminSurveyorDetail> {
    return this.request<AdminSurveyorDetail>('PATCH', `/admin/surveyors/${id}`, body);
  }

  async createMatch(body: CreateMatchBody): Promise<Match> {
    return this.request<Match>('POST', '/admin/matches', body);
  }

  async updateMatch(id: string, body: UpdateMatchBody): Promise<Match> {
    return this.request<Match>('PATCH', `/admin/matches/${id}`, body);
  }

  async updateProjectStatus(id: string, status: ProjectStatus): Promise<ProjectDetail> {
    return this.request<ProjectDetail>('PATCH', `/admin/projects/${id}/status`, { status });
  }

  async submitFeedback(body: {
    matchId: string;
    rating: number;
    comment: string;
    aspects?: Partial<
      Record<'product' | 'partnership' | 'matching' | 'reliability', number>
    >;
    recommend?: boolean | null;
    asRole?: 'client' | 'surveyor';
  }): Promise<FeedbackSubmitResult> {
    return this.request<FeedbackSubmitResult>('POST', '/feedback', body);
  }

  async getMyMatchFeedback(matchId: string): Promise<Feedback | null> {
    return this.request<Feedback | null>('GET', `/feedback/match/${matchId}/mine`);
  }

  async listAdminFeedback(): Promise<Feedback[]> {
    return this.request<Feedback[]>('GET', '/admin/feedback');
  }

  async submitSiteFeedback(body: {
    name?: string;
    email?: string;
    rating: number;
    message: string;
    source?: 'landing' | 'support' | 'other';
    company?: string;
  }): Promise<SiteFeedbackSubmitResult> {
    return this.request<SiteFeedbackSubmitResult>('POST', '/public/feedback', body);
  }

  async listAdminSiteFeedback(): Promise<SiteFeedback[]> {
    return this.request<SiteFeedback[]>('GET', '/admin/site-feedback');
  }

  async createHelpTicket(body: {
    workspace: HelpTicketWorkspace;
    category: HelpTicketCategory;
    priority?: HelpTicketPriority;
    subject: string;
    body: string;
    projectId?: string | null;
    attachments?: Array<{ url: string; fileName: string; contentType?: string | null }>;
  }): Promise<HelpTicketDetail> {
    return this.request<HelpTicketDetail>('POST', '/helpdesk/tickets', body);
  }

  async listMyHelpTickets(workspace: HelpTicketWorkspace): Promise<HelpTicket[]> {
    const qs = new URLSearchParams({ workspace });
    return this.request<HelpTicket[]>('GET', `/helpdesk/tickets?${qs}`);
  }

  async getMyHelpTicket(id: string, workspace: HelpTicketWorkspace): Promise<HelpTicketDetail> {
    const qs = new URLSearchParams({ workspace });
    return this.request<HelpTicketDetail>('GET', `/helpdesk/tickets/${id}?${qs}`);
  }

  async replyHelpTicket(
    id: string,
    body:
      | string
      | {
          body: string;
          attachments?: Array<{ url: string; fileName: string; contentType?: string | null }>;
        },
    workspace: HelpTicketWorkspace,
  ): Promise<HelpTicketDetail> {
    const payload = typeof body === 'string' ? { body } : body;
    const qs = new URLSearchParams({ workspace });
    return this.request<HelpTicketDetail>(
      'POST',
      `/helpdesk/tickets/${id}/messages?${qs}`,
      payload,
    );
  }

  async listAdminHelpTickets(): Promise<HelpTicket[]> {
    return this.request<HelpTicket[]>('GET', '/admin/helpdesk/tickets');
  }

  async getAdminHelpTicket(id: string): Promise<HelpTicketDetail> {
    return this.request<HelpTicketDetail>('GET', `/admin/helpdesk/tickets/${id}`);
  }

  async updateAdminHelpTicket(
    id: string,
    body: { status?: HelpTicketStatus; priority?: HelpTicketPriority },
  ): Promise<HelpTicketDetail> {
    return this.request<HelpTicketDetail>('PATCH', `/admin/helpdesk/tickets/${id}`, body);
  }

  async replyAdminHelpTicket(
    id: string,
    body:
      | string
      | {
          body: string;
          attachments?: Array<{ url: string; fileName: string; contentType?: string | null }>;
        },
  ): Promise<HelpTicketDetail> {
    const payload = typeof body === 'string' ? { body } : body;
    return this.request<HelpTicketDetail>(
      'POST',
      `/admin/helpdesk/tickets/${id}/messages`,
      payload,
    );
  }

  async getProjectActivity(projectId: string): Promise<ActivityLogEntry[]> {
    return this.request<ActivityLogEntry[]>('GET', `/admin/projects/${projectId}/activity`);
  }

  async getHelpTicketActivity(ticketId: string): Promise<ActivityLogEntry[]> {
    return this.request<ActivityLogEntry[]>('GET', `/admin/helpdesk/tickets/${ticketId}/activity`);
  }

  async getEntityActivity(
    entityType: ActivityEntityType,
    entityId: string,
  ): Promise<ActivityLogEntry[]> {
    const qs = new URLSearchParams({ entityType, entityId });
    return this.request<ActivityLogEntry[]>('GET', `/admin/activity?${qs.toString()}`);
  }

  async listStaffAdmins(): Promise<StaffAdmin[]> {
    return this.request<StaffAdmin[]>('GET', '/admin/staff');
  }

  async createStaffAdmin(body: CreateStaffAdminBody): Promise<StaffAdmin> {
    return this.request<StaffAdmin>('POST', '/admin/staff', body);
  }

  async updateStaffAdmin(userId: string, body: UpdateStaffAdminBody): Promise<StaffAdmin> {
    return this.request<StaffAdmin>('PATCH', `/admin/staff/${userId}`, body);
  }

  async removeStaffAdmin(userId: string): Promise<void> {
    await this.request<void>('DELETE', `/admin/staff/${userId}`);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.options.getAuthToken?.();
    const headers: Record<string, string> = { Accept: 'application/json' };
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined
        ? undefined
        : isFormData
          ? body as FormData
          : JSON.stringify(body),
    });

    const payload = await res.json().catch(() => undefined);
    if (!res.ok) {
      if (res.status === 401 && token) {
        try {
          await this.options.onUnauthorized?.();
        } catch {
          /* redirect/cleanup must not mask the ApiError */
        }
      }
      throw new ApiError(
        `Request failed: ${method} ${path} (${res.status})`,
        res.status,
        payload,
      );
    }
    if (res.status === 204) return undefined as T;
    return payload as T;
  }
}

export function createClient(options: ApiClientOptions): SurveyLinkClient {
  return new SurveyLinkClient(options);
}
