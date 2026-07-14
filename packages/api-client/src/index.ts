import type {
  HealthStatus,
  AuthSession,
  AuthenticatedUser,
  GoogleAuthResult,
  RoleHint,
  SurveyorProfile,
  SurveyorStatus,
  SurveyService,
  GeoPoint,
  PortfolioItem,
  Project,
  ProjectDetail,
  AdminQueues,
  AdminSurveyor,
  Match,
  MatchStatus,
  ProjectStatus,
  Notification,
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
  isMatchable?: boolean;
}

export interface SignupBody {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  roleHint?: 'client' | 'surveyor' | 'admin';
}

export interface LoginBody {
  email: string;
  password: string;
  /** Marketplace workspace to enter. Omit for staff portal. */
  role?: 'client' | 'surveyor';
}

export interface AddMembershipBody {
  role: 'client' | 'surveyor';
}

export interface GoogleExchangeBody {
  code: string;
  state: string;
}

export interface CompleteRegistrationBody {
  fullName: string;
  email?: string;
  phone: string;
  roleHint?: RoleHint;
}

export interface AdminSurveyorQueryBody {
  service?: SurveyService;
  nearLat?: number;
  nearLng?: number;
  radiusKm?: number;
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

export interface ApiClientOptions {
  baseUrl: string;
  /** Optional bearer token / session accessor, resolved per-request. */
  getAuthToken?: () => string | undefined | Promise<string | undefined>;
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

  async signup(body: SignupBody): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('POST', '/auth/signup', body);
  }

  async login(body: LoginBody): Promise<AuthSession> {
    return this.request<AuthSession>('POST', '/auth/login', body);
  }

  /** Resolve the "Continue with Google" URL to navigate the browser to. */
  async googleStartUrl(role?: RoleHint): Promise<{ url: string }> {
    const suffix = role ? `?role=${encodeURIComponent(role)}` : '';
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

  async verifyEmail(): Promise<AuthenticatedUser> {
    return this.request<AuthenticatedUser>('POST', '/auth/verify-email', {});
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

  async browseAdminSurveyors(query: AdminSurveyorQueryBody = {}): Promise<AdminSurveyor[]> {
    const qs = new URLSearchParams();
    if (query.service) qs.set('service', query.service);
    if (query.nearLat != null) qs.set('nearLat', String(query.nearLat));
    if (query.nearLng != null) qs.set('nearLng', String(query.nearLng));
    if (query.radiusKm != null) qs.set('radiusKm', String(query.radiusKm));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<AdminSurveyor[]>('GET', `/admin/surveyors${suffix}`);
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

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.options.getAuthToken?.();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = await res.json().catch(() => undefined);
    if (!res.ok) {
      throw new ApiError(
        `Request failed: ${method} ${path} (${res.status})`,
        res.status,
        payload,
      );
    }
    return payload as T;
  }
}

export function createClient(options: ApiClientOptions): SurveyLinkClient {
  return new SurveyLinkClient(options);
}
