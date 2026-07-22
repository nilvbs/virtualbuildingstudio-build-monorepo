import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type {
  AccountType,
  AppRole,
  AuthenticatedUser,
  AuthPrincipal,
  AuthSession,
  GoogleAuthResult,
  MembershipRole,
  OnboardingStatus,
  OnboardingStep,
  PostalAddress,
  RoleHint,
  SignupResult,
  StaffLevel,
  StaffPermission,
  StaffPermissionPreset,
  UserStatus,
  WorkspaceRole,
} from '@surveylink/types';
import { ROLE_HINTS, resolveStaffPermissions } from '@surveylink/types';
import type {
  AddMembershipInput,
  CompleteProfileInput,
  CompleteRegistrationInput,
  SignupInput,
  UpdateMeInput,
} from '@surveylink/validation';
import type { AccountProfile, ClientProfile } from '@prisma/client';
import { normalizeEmail } from '@surveylink/validation';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IDENTITY_PROVIDER, type IdentityProvider } from './identity/identity-provider';
import { AUTH_PROVIDER_NAME, GOOGLE_PROVIDER_NAME } from './identity/auth0.identity-provider';
import { PHONE_VERIFIER, type PhoneVerifier } from './phone/phone-verifier';
import { EmailOtpService } from './email/email-otp.service';
import {
  DEV_ACCESS_TOKEN,
  DEV_EMAIL,
  DEV_GOOGLE_ACCESS_TOKEN,
  DEV_GOOGLE_CODE,
  DEV_GOOGLE_EMAIL,
  DEV_GOOGLE_SUBJECT,
  DEV_PASSWORD,
  DEV_SUBJECT,
  devAuthEnabled,
  devSubjectForEmail,
  findDevSignup,
  issueDevUserToken,
  rememberDevSignup,
} from './dev-auth';
import { ensureMembership, hintFromMemberships, listMemberships } from './memberships';

const GOOGLE_CONNECTION = 'google-oauth2';

interface OAuthState {
  role: RoleHint;
  nonce: string;
}

function normalizeRole(raw: string | undefined): RoleHint {
  return ROLE_HINTS.includes(raw as RoleHint) ? (raw as RoleHint) : 'client';
}

function encodeState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}

function decodeState(raw: string): OAuthState {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<OAuthState>;
    return { role: normalizeRole(parsed.role), nonce: parsed.nonce ?? '' };
  } catch {
    return { role: 'client', nonce: '' };
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
    @Inject(PHONE_VERIFIER) private readonly phone: PhoneVerifier,
    private readonly emailOtp: EmailOtpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Create the account, issue a session, and start email + phone OTP.
   * Non-Google users land on `verify_contact` until at least one channel is verified.
   */
  async signup(input: SignupInput): Promise<SignupResult> {
    const membershipRole = input.roleHint as MembershipRole;
    const legacyHint = membershipRole as WorkspaceRole;
    const email = normalizeEmail(input.email);

    const existing =
      (await this.findUserByEmail(email)) ??
      (await this.prisma.user.findFirst({ where: { phone: input.phone } }));

    // Same identity, different workspace: add the missing membership instead of
    // creating a second user (email/phone stay unique on `users`).
    if (existing) {
      const user = await this.addRoleToExistingUser(
        existing,
        { ...input, email },
        membershipRole,
      );
      const session = await this.login(email, input.password, legacyHint);
      return { session, user };
    }

    if (devAuthEnabled(this.config)) {
      const subject = devSubjectForEmail(email);
      rememberDevSignup(email, input.password, subject);
      const user = await this.prisma.user.create({
        data: {
          fullName: input.fullName,
          email,
          phone: input.phone,
          roleHint: legacyHint,
          accountType: input.accountType ?? 'individual',
          emailVerified: true,
          phoneVerified: true,
          onboardingStep: 'select_account_type',
          authProvider: 'dev',
          authSubject: subject,
        },
      });
      await ensureMembership(this.prisma, user.id, membershipRole);
      const hydrated = await this.hydrateUser(user, []);
      const session: AuthSession = {
        accessToken: issueDevUserToken(subject),
        tokenType: 'Bearer',
        expiresIn: 60 * 60 * 24,
        activeRole: legacyHint,
      };
      return { session, user: hydrated };
    }

    const identity = await this.identity.createIdentity({
      fullName: input.fullName,
      email,
      phone: input.phone,
      password: input.password,
    });

    const emailAlreadyVerified = identity.emailVerified;
    const user = await this.prisma.user.create({
      data: {
        fullName: input.fullName,
        email,
        phone: input.phone,
        roleHint: legacyHint,
        accountType: input.accountType ?? 'individual',
        emailVerified: emailAlreadyVerified,
        // Account type is chosen on the first onboarding screen.
        onboardingStep: 'select_account_type',
        authProvider: AUTH_PROVIDER_NAME,
        authSubject: identity.subject,
      },
    });
    await ensureMembership(this.prisma, user.id, membershipRole);

    await Promise.allSettled([
      emailAlreadyVerified ? Promise.resolve() : this.emailOtp.start(user.id, email),
      this.phone.startVerification(user.id, input.phone),
    ]);

    const session = await this.identity.login(email, input.password);
    const hydrated = await this.hydrateUser(user, []);
    return {
      session: { ...session, activeRole: legacyHint },
      user: hydrated,
    };
  }

  /**
   * Attach another segregated role (client / surveyor / admin) to an existing
   * identity after verifying the password. Profile tables stay separate.
   */
  private async addRoleToExistingUser(
    existing: User,
    input: SignupInput,
    membershipRole: MembershipRole,
  ): Promise<AuthenticatedUser> {
    const emailMatch = normalizeEmail(existing.email) === normalizeEmail(input.email);
    const phoneMatch = existing.phone === input.phone;
    if (!emailMatch || !phoneMatch) {
      throw new ConflictException(
        'That email or phone is already used by another account. Use the same email and phone as your existing account to add this role, or pick different contact details.',
      );
    }

    const memberships = await listMemberships(this.prisma, existing.id);
    if (memberships.includes(membershipRole)) {
      throw new ConflictException(
        `This account already has the ${membershipRole} role. Sign in to that workspace instead.`,
      );
    }

    await this.assertPasswordForUser(existing, input.password);

    // Keepdev password map in sync when adding roles under AUTH_DEV_MODE.
    if (devAuthEnabled(this.config) && existing.authSubject) {
      rememberDevSignup(normalizeEmail(input.email), input.password, existing.authSubject);
    }

    await ensureMembership(this.prisma, existing.id, membershipRole);
    const refreshed = await this.prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
    const next = await listMemberships(this.prisma, existing.id);
    return this.hydrateUser(refreshed, next.includes('admin') ? ['admin'] : []);
  }

  private async assertPasswordForUser(user: User, password: string): Promise<void> {
    if (devAuthEnabled(this.config)) {
      if (normalizeEmail(user.email) === DEV_EMAIL && password === DEV_PASSWORD) return;
      const local = findDevSignup(user.email);
      if (local) {
        if (local.password === password) return;
        throw new UnauthorizedException(
          'Email already registered. Enter the same password as that account to add this role.',
        );
      }
      // Dev password map clears on API restart — re-bind without calling Auth0.
      await this.loginLocalDevUser(user.email, password);
      return;
    }
    try {
      await this.identity.login(normalizeEmail(user.email), password);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        'Email already registered. Enter the same password as that account to add this role.',
      );
    }
  }

  /**
   * AUTH_DEV_MODE password login that never calls Auth0. Re-binds existing local
   * accounts after API restarts (in-memory password map is empty).
   */
  private async loginLocalDevUser(email: string, password: string): Promise<AuthSession> {
    const normalized = normalizeEmail(email);
    const existing = await this.findUserByEmail(normalized);

    if (!existing) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (existing.authProvider === GOOGLE_PROVIDER_NAME) {
      throw new UnauthorizedException('This account uses Google sign-in.');
    }

    const subject =
      existing.authSubject?.startsWith('dev|')
        ? existing.authSubject
        : existing.authProvider === 'dev' && existing.authSubject
          ? existing.authSubject
          : devSubjectForEmail(normalized);

    if (existing.authProvider !== 'dev' || existing.authSubject !== subject) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { authProvider: 'dev', authSubject: subject },
      });
    }

    rememberDevSignup(normalized, password, subject);
    return {
      accessToken: issueDevUserToken(subject),
      tokenType: 'Bearer',
      expiresIn: 60 * 60 * 24,
    };
  }

  async login(email: string, password: string, role?: WorkspaceRole): Promise<AuthSession> {
    const normalized = normalizeEmail(email);
    let session: AuthSession;

    if (devAuthEnabled(this.config)) {
      if (normalized === DEV_EMAIL && password === DEV_PASSWORD) {
        await this.ensureDevUser();
        session = {
          accessToken: DEV_ACCESS_TOKEN,
          tokenType: 'Bearer',
          expiresIn: 60 * 60 * 24,
        };
      } else {
        const local = findDevSignup(normalized);
        if (local) {
          if (local.password !== password) {
            throw new UnauthorizedException('Invalid email or password.');
          }
          session = {
            accessToken: issueDevUserToken(local.subject),
            tokenType: 'Bearer',
            expiresIn: 60 * 60 * 24,
          };
        } else {
          // Password map is in-memory and clears on API restart. Keep local
          // AUTH_DEV_MODE users on the in-process path so mobile/web never
          // fall through to Auth0 when it is not configured.
          session = await this.loginLocalDevUser(normalized, password);
        }
      }
    } else {
      session = await this.identity.login(normalized, password);
    }

    const user = await this.findUserByEmail(normalized);
    if (!user) {
      return session;
    }

    const memberships = await listMemberships(this.prisma, user.id);

    if (role) {
      if (!memberships.includes(role)) {
        throw new ForbiddenException(
          `No ${role} workspace on this account. Sign up as a ${role}, or add that role from your other workspace.`,
        );
      }
      return { ...session, activeRole: role };
    }

    // Staff portal omits role; JWT admin claim is checked after login.
    return session;
  }

  /**
   * Marketplace forgot-password. Sends an Auth0 reset email only when the
   * account has the requested client/surveyor membership. Staff-only accounts
   * never receive a reset from this path (anti-enumeration still returns ok).
   */
  async forgotPassword(
    email: string,
    role: 'client' | 'surveyor',
  ): Promise<{ ok: true; message: string }> {
    const message =
      'If an account exists for that email, we sent a password reset link. Check your inbox.';
    const normalized = normalizeEmail(email);

    const user = await this.findUserByEmail(normalized);

    if (!user) {
      return { ok: true, message };
    }

    const memberships = await listMemberships(this.prisma, user.id);
    if (!memberships.includes(role)) {
      // Wrong workspace or staff-only — do not reset.
      return { ok: true, message };
    }

    // Google-only marketplace users have no DB password to reset.
    if (user.authProvider === GOOGLE_PROVIDER_NAME) {
      return { ok: true, message };
    }

    if (devAuthEnabled(this.config)) {
      // Local bypass has no outbound email; keep response identical.
      return { ok: true, message };
    }

    await this.identity.requestPasswordReset(user.email);
    return { ok: true, message };
  }

  /** Case-insensitive email lookup; rewrites legacy mixed-case rows to lowercase. */
  private async findUserByEmail(email: string): Promise<User | null> {
    const normalized = normalizeEmail(email);
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
    });
    if (!user) return null;
    if (user.email === normalized) return user;
    try {
      return await this.prisma.user.update({
        where: { id: user.id },
        data: { email: normalized },
      });
    } catch {
      return user;
    }
  }

  private async ensureDevUser(): Promise<void> {
    const user = await this.prisma.user.upsert({
      where: { authSubject: DEV_SUBJECT },
      update: {},
      create: {
        fullName: 'Dev Tester',
        email: DEV_EMAIL,
        phone: '+10000000001',
        emailVerified: true,
        phoneVerified: true,
        onboardingStep: 'done',
        roleHint: 'both',
        status: 'active',
        authProvider: 'dev',
        authSubject: DEV_SUBJECT,
      },
    });
    await ensureMembership(this.prisma, user.id, 'client');
    await ensureMembership(this.prisma, user.id, 'surveyor');
    await ensureMembership(this.prisma, user.id, 'admin');
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.identity.revokeRefreshToken(refreshToken);
    }
  }

  private get webAppUrl(): string {
    return (this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  private get googleRedirectUri(): string {
    return `${this.webAppUrl}/auth/callback`;
  }

  /** Build the URL the browser should navigate to for "Continue with Google". */
  startGoogleLogin(roleRaw: string | undefined): { url: string } {
    const state = encodeState({ role: normalizeRole(roleRaw), nonce: randomBytes(12).toString('hex') });

    // Dev bypass: skip Auth0 entirely and bounce straight to the callback.
    if (devAuthEnabled(this.config)) {
      const params = new URLSearchParams({ code: DEV_GOOGLE_CODE, state });
      return { url: `${this.googleRedirectUri}?${params.toString()}` };
    }

    const connection = this.config.get<string>('AUTH0_GOOGLE_CONNECTION') ?? GOOGLE_CONNECTION;
    const url = this.identity.buildSocialAuthorizeUrl({
      redirectUri: this.googleRedirectUri,
      state,
      connection,
    });
    return { url };
  }

  /**
   * Exchange the Google authorization code for a session. If a local account is
   * already linked to the identity the caller is fully signed in; otherwise the
   * session is valid but registration must be completed (phone + role).
   */
  async exchangeGoogle(code: string, state: string): Promise<GoogleAuthResult> {
    const { role } = decodeState(state);
    const workspaceRole: WorkspaceRole | undefined =
      role === 'client' || role === 'surveyor' ? role : undefined;

    // Dev bypass: fabricate a session for the fixed Google dev identity.
    if (devAuthEnabled(this.config) && code === DEV_GOOGLE_CODE) {
      const session: AuthSession = {
        accessToken: DEV_GOOGLE_ACCESS_TOKEN,
        tokenType: 'Bearer',
        expiresIn: 60 * 60 * 24,
      };
      const existing = await this.prisma.user.findUnique({
        where: { authSubject: DEV_GOOGLE_SUBJECT },
      });
      if (existing) {
        return this.googleResultForExistingUser(existing, session, workspaceRole);
      }
      return {
        session: { ...session, activeRole: workspaceRole },
        registered: false,
        roleHint: workspaceRole ?? 'client',
        profile: { email: DEV_GOOGLE_EMAIL, fullName: 'Dev Google User' },
      };
    }

    const { session, identity } = await this.identity.exchangeAuthorizationCode({
      code,
      redirectUri: this.googleRedirectUri,
    });

    const existing = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
    });
    if (existing) {
      return this.googleResultForExistingUser(existing, session, workspaceRole);
    }

    // Account linking (same email, different provider) is out of scope for
    // Phase 1 — steer the user to their existing password login instead.
    if (identity.email) {
      const emailOwner = await this.findUserByEmail(identity.email);
      if (emailOwner) {
        throw new ConflictException(
          'An account with this email already exists. Please sign in with your email and password.',
        );
      }
    }

    return {
      session: { ...session, activeRole: workspaceRole },
      registered: false,
      roleHint: workspaceRole ?? 'client',
      profile: {
        email: identity.email ? normalizeEmail(identity.email) : identity.email,
        fullName: identity.fullName,
      },
    };
  }

  /**
   * Returning Google user: honor the workspace chosen on the landing auth step
   * (add membership if missing) so "Sign up as surveyor" does not land on /client.
   */
  private async googleResultForExistingUser(
    existing: User,
    session: AuthSession,
    workspaceRole: WorkspaceRole | undefined,
  ): Promise<GoogleAuthResult> {
    if (workspaceRole) {
      await ensureMembership(this.prisma, existing.id, workspaceRole);
    }
    const memberships = await listMemberships(this.prisma, existing.id);
    const activeRole =
      workspaceRole ??
      (memberships.includes('surveyor') && !memberships.includes('client')
        ? 'surveyor'
        : memberships.includes('client')
          ? 'client'
          : undefined);

    return {
      session: { ...session, activeRole },
      registered: true,
      roleHint: hintFromMemberships(memberships),
      profile: { email: existing.email, fullName: existing.fullName },
    };
  }

  /**
   * Finish a social sign-up: the identity exists at the provider (the caller is
   * authenticated), we just persist the local row with the phone + role the
   * provider can't supply, then kick off phone verification.
   */
  async completeRegistration(
    principal: AuthPrincipal,
    input: CompleteRegistrationInput,
  ): Promise<AuthenticatedUser> {
    const already = await this.prisma.user.findUnique({ where: { authSubject: principal.sub } });
    if (already) {
      return this.hydrateUser(already, principal.roles);
    }

    const rawEmail = principal.email ?? input.email;
    if (!rawEmail) {
      throw new BadRequestException('Could not determine the account email from the identity');
    }
    const email = normalizeEmail(rawEmail);

    const clash =
      (await this.findUserByEmail(email)) ??
      (await this.prisma.user.findFirst({ where: { phone: input.phone }, select: { id: true } }));
    if (clash) {
      throw new ConflictException('An account with this email or phone already exists');
    }

    const isDevGoogle = devAuthEnabled(this.config) && principal.sub === DEV_GOOGLE_SUBJECT;

    const workspaceRole = input.roleHint as WorkspaceRole;
    const emailVerified = principal.emailVerified ?? true;
    const user = await this.prisma.user.create({
      data: {
        fullName: input.fullName,
        email,
        phone: input.phone,
        roleHint: workspaceRole,
        accountType: input.accountType ?? 'individual',
        // Social providers (Google) return already-verified emails.
        emailVerified,
        // Account type is chosen on the first onboarding screen.
        onboardingStep: 'select_account_type',
        authProvider: isDevGoogle ? 'dev' : GOOGLE_PROVIDER_NAME,
        authSubject: principal.sub,
      },
    });
    await ensureMembership(this.prisma, user.id, workspaceRole);

    // Best-effort, consistent with signup: missing SNS config must not fail this.
    await Promise.allSettled([this.phone.startVerification(user.id, input.phone)]);

    return this.hydrateUser(user, principal.roles);
  }

  async addMembership(principal: AuthPrincipal, input: AddMembershipInput): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    await ensureMembership(this.prisma, user.id, input.role);
    const updated = await this.requireUser(principal.sub);
    return this.hydrateUser(updated, principal.roles);
  }

  async me(principal: AuthPrincipal): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    return this.hydrateUser(user, principal.roles);
  }

  /** Send (or resend) an email OTP for the authenticated user. */
  async startEmailVerification(principal: AuthPrincipal): Promise<{ ok: true }> {
    const user = await this.requireUser(principal.sub);
    if (user.emailVerified) {
      return { ok: true };
    }
    await this.emailOtp.start(user.id, user.email);
    return { ok: true };
  }

  /** Send (or resend) a phone SMS OTP for the authenticated user. */
  async startPhoneVerification(
    principal: AuthPrincipal,
    phone?: string,
  ): Promise<{ ok: true }> {
    const user = await this.requireUser(principal.sub);
    if (user.phoneVerified) {
      return { ok: true };
    }

    let targetPhone = user.phone;
    if (phone) {
      if (phone !== user.phone) {
        const clash = await this.prisma.user.findFirst({
          where: { phone, NOT: { id: user.id } },
          select: { id: true },
        });
        if (clash) {
          throw new ConflictException('An account with this phone number already exists');
        }
        await this.prisma.user.update({
          where: { id: user.id },
          data: { phone },
        });
      }
      targetPhone = phone;
    }

    await this.phone.startVerification(user.id, targetPhone);
    return { ok: true };
  }

  /** Confirm email OTP and advance onboarding when at least one contact is verified. */
  async verifyEmail(principal: AuthPrincipal, code: string): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    const approved = await this.emailOtp.check(user.id, user.email, code);
    if (!approved) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }
    const nextStep = this.stepAfterContactVerified(user);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, onboardingStep: nextStep },
    });
    return this.hydrateUser(updated, principal.roles);
  }

  /** Confirm the SMS OTP for the authenticated user's phone number. */
  async verifyPhone(principal: AuthPrincipal, code: string): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    const approved = await this.phone.checkVerification(user.id, user.phone, code);
    if (!approved) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }
    const nextStep = this.stepAfterContactVerified(user);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true, onboardingStep: nextStep },
    });
    return this.hydrateUser(updated, principal.roles);
  }

  async getOnboarding(principal: AuthPrincipal): Promise<OnboardingStatus> {
    const user = await this.requireUser(principal.sub);
    const memberships = await listMemberships(this.prisma, user.id);
    const clientProfile = memberships.includes('client')
      ? await this.prisma.clientProfile.findUnique({ where: { userId: user.id } })
      : null;
    const accountProfile = await this.prisma.accountProfile.findUnique({
      where: { userId: user.id },
    });
    return this.toOnboardingStatus(user, memberships, clientProfile, accountProfile);
  }

  /**
   * First onboarding glance: choose company vs individual, then advance to Terms/NDA.
   * There is no skip — login keeps routing here until a type is selected.
   */
  async selectAccountType(
    principal: AuthPrincipal,
    accountType: AccountType,
  ): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    if (user.accountTypeSelectedAt) {
      throw new BadRequestException('Account type was already selected');
    }
    const nextStep =
      user.onboardingStep === 'select_account_type' ? 'accept_terms' : (user.onboardingStep as OnboardingStep);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        accountType,
        accountTypeSelectedAt: new Date(),
        onboardingStep: nextStep,
      },
    });
    return this.hydrateUser(updated, principal.roles);
  }

  /**
   * Middle acceptance gate: record Terms & NDA acceptance (both required) and
   * advance out of `accept_terms`. There is no bypass — the client cannot skip
   * this step, and every login routes back here until it is accepted.
   */
  async acceptTerms(principal: AuthPrincipal): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    if (user.onboardingStep === 'select_account_type') {
      throw new BadRequestException('Select individual or company before accepting terms');
    }
    const now = new Date();
    const nextStep =
      user.onboardingStep === 'accept_terms' ? this.stepAfterTermsAccepted(user) : (user.onboardingStep as OnboardingStep);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        termsAcceptedAt: user.termsAcceptedAt ?? now,
        ndaAcceptedAt: user.ndaAcceptedAt ?? now,
        onboardingStep: nextStep,
      },
    });
    return this.hydrateUser(updated, principal.roles);
  }

  /** Company-only: store the work email and send it an OTP (separate from signup email). */
  async startWorkEmailVerification(
    principal: AuthPrincipal,
    workEmail: string,
  ): Promise<{ ok: true }> {
    const user = await this.requireUser(principal.sub);
    if (user.accountType !== 'company') {
      throw new BadRequestException('Work email is only required for company accounts');
    }
    const normalized = normalizeEmail(workEmail);
    await this.prisma.accountProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, workEmail: normalized, workEmailVerified: false },
      update: { workEmail: normalized, workEmailVerified: false },
    });
    await this.emailOtp.start(user.id, normalized, 'work_email');
    return { ok: true };
  }

  /** Company-only: confirm the work email OTP. */
  async verifyWorkEmail(principal: AuthPrincipal, code: string): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    const profile = await this.prisma.accountProfile.findUnique({ where: { userId: user.id } });
    if (!profile?.workEmail) {
      throw new BadRequestException('Add your work email before verifying it');
    }
    const approved = await this.emailOtp.check(user.id, profile.workEmail, code, 'work_email');
    if (!approved) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }
    await this.prisma.accountProfile.update({
      where: { userId: user.id },
      data: { workEmailVerified: true },
    });
    return this.hydrateUser(user, principal.roles);
  }

  /** Update personal profile fields (name, avatar, company, address). */
  async updateMe(principal: AuthPrincipal, input: UpdateMeInput): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    const memberships = await listMemberships(this.prisma, user.id);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.avatarKey !== undefined ? { avatarKey: input.avatarKey } : {}),
      },
    });

    if (input.companyName !== undefined && memberships.includes('client')) {
      await this.prisma.clientProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, companyName: input.companyName },
        update: { companyName: input.companyName },
      });
    }

    if (
      input.address !== undefined ||
      input.registrationNumber !== undefined ||
      input.website !== undefined
    ) {
      const addressData = input.address
        ? {
            addressLine1: input.address.line1,
            addressLine2: input.address.line2?.trim() ? input.address.line2.trim() : null,
            city: input.address.city,
            state: input.address.state,
            postalCode: input.address.postalCode,
            country: input.address.country,
          }
        : {};
      const companyData = {
        ...(input.registrationNumber !== undefined
          ? { registrationNumber: input.registrationNumber?.trim() || null }
          : {}),
        ...(input.website !== undefined
          ? { website: input.website?.trim() || null }
          : {}),
      };
      await this.prisma.accountProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...addressData, ...companyData },
        update: { ...addressData, ...companyData },
      });
    }

    return this.hydrateUser(updated, principal.roles);
  }

  /**
   * Finish personal profile. Surveyors advance to portfolio builder; clients to done.
   * Remaining contact OTP can still be completed from this step (does not block).
   */
  async completeProfile(
    principal: AuthPrincipal,
    input: CompleteProfileInput,
  ): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    if (!user.termsAcceptedAt || !user.ndaAcceptedAt) {
      throw new BadRequestException('Accept the Terms & Conditions and NDA before continuing');
    }
    if (!user.emailVerified && !user.phoneVerified) {
      throw new BadRequestException('Verify your email or phone before completing your profile');
    }
    if (!input.address) {
      throw new BadRequestException('Add your address to continue');
    }

    const isCompany = user.accountType === 'company';
    if (isCompany) {
      const existing = await this.prisma.accountProfile.findUnique({ where: { userId: user.id } });
      if (!existing?.workEmailVerified) {
        throw new BadRequestException('Verify your work email before continuing');
      }
      if (!input.registrationNumber || !input.registrationNumber.trim()) {
        throw new BadRequestException('Company registration number is required');
      }
    }

    const memberships = await listMemberships(this.prisma, user.id);
    const requiresPortfolio = memberships.includes('surveyor');
    const nextStep: OnboardingStep = requiresPortfolio ? 'portfolio' : 'done';

    const website = input.website?.trim() ? input.website.trim() : null;
    const addressData = {
      addressLine1: input.address.line1,
      addressLine2: input.address.line2?.trim() ? input.address.line2.trim() : null,
      city: input.address.city,
      state: input.address.state,
      postalCode: input.address.postalCode,
      country: input.address.country,
    };
    const companyData = isCompany
      ? { registrationNumber: input.registrationNumber!.trim(), website }
      : {};

    await this.prisma.accountProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...addressData, ...companyData },
      update: { ...addressData, ...companyData },
    });

    if (input.companyName !== undefined && memberships.includes('client')) {
      await this.prisma.clientProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, companyName: input.companyName },
        update: { companyName: input.companyName },
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.avatarKey !== undefined ? { avatarKey: input.avatarKey } : {}),
        onboardingStep: nextStep,
      },
    });
    return this.hydrateUser(updated, principal.roles);
  }

  /** Surveyor-only: mark portfolio onboarding complete. */
  async completePortfolio(principal: AuthPrincipal): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    const memberships = await listMemberships(this.prisma, user.id);
    if (!memberships.includes('surveyor')) {
      throw new ForbiddenException('Portfolio onboarding is only for surveyors');
    }
    if (user.onboardingStep !== 'portfolio' && user.onboardingStep !== 'done') {
      throw new BadRequestException('Complete your personal profile before the portfolio builder');
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { onboardingStep: 'done' },
    });
    return this.hydrateUser(updated, principal.roles);
  }

  private stepAfterContactVerified(user: User): OnboardingStep {
    const current = user.onboardingStep as OnboardingStep;
    if (current === 'verify_contact') return 'complete_profile';
    return current;
  }

  /** After Terms & NDA: skip contact verification when a channel is already verified. */
  private stepAfterTermsAccepted(user: User): OnboardingStep {
    return user.emailVerified || user.phoneVerified ? 'complete_profile' : 'verify_contact';
  }

  private toOnboardingStatus(
    user: User,
    memberships: MembershipRole[],
    clientProfile: ClientProfile | null,
    accountProfile: AccountProfile | null,
  ): OnboardingStatus {
    const pendingContact =
      !user.emailVerified && !user.phoneVerified
        ? 'both'
        : !user.emailVerified
          ? 'email'
          : !user.phoneVerified
            ? 'phone'
            : 'none';

    const address: PostalAddress = {
      line1: accountProfile?.addressLine1 ?? null,
      line2: accountProfile?.addressLine2 ?? null,
      city: accountProfile?.city ?? null,
      state: accountProfile?.state ?? null,
      postalCode: accountProfile?.postalCode ?? null,
      country: accountProfile?.country ?? null,
    };

    const phoneNeedsEntry =
      !user.phoneVerified &&
      (!user.phone || user.phone === '+10000000001' || user.phone === '+1' || user.phone.length < 10);

    const effectiveStep: OnboardingStep = !user.accountTypeSelectedAt
      ? 'select_account_type'
      : (user.onboardingStep as OnboardingStep);

    return {
      step: effectiveStep,
      accountType: user.accountType as AccountType,
      accountTypeSelected: user.accountTypeSelectedAt != null,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      phone: user.phone,
      phoneNeedsEntry,
      termsAccepted: user.termsAcceptedAt != null,
      ndaAccepted: user.ndaAcceptedAt != null,
      canCompleteProfile: user.emailVerified || user.phoneVerified,
      pendingContact,
      requiresPortfolio: memberships.includes('surveyor'),
      avatarKey: user.avatarKey,
      fullName: user.fullName,
      companyName: clientProfile?.companyName ?? null,
      address,
      workEmail: accountProfile?.workEmail ?? null,
      workEmailVerified: accountProfile?.workEmailVerified ?? false,
      registrationNumber: accountProfile?.registrationNumber ?? null,
      website: accountProfile?.website ?? null,
    };
  }

  private async requireUser(subject: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { authSubject: subject } });
    if (!user) {
      throw new NotFoundException('No local account is linked to this identity');
    }
    return user;
  }

  private async hydrateUser(user: User, roles: AppRole[]): Promise<AuthenticatedUser> {
    const memberships = await listMemberships(this.prisma, user.id);
    const adminProfile = memberships.includes('admin')
      ? await this.prisma.adminProfile.findUnique({ where: { userId: user.id } })
      : null;
    return this.toAuthenticatedUser(user, roles, memberships, adminProfile);
  }

  private toAuthenticatedUser(
    user: User,
    roles: AppRole[],
    memberships: MembershipRole[] = [],
    adminProfile: {
      staffLevel: string;
      permissionPreset: string;
      permissions: unknown;
    } | null = null,
  ): AuthenticatedUser {
    const merged = memberships.length
      ? memberships
      : ((user.roleHint === 'both'
          ? (['client', 'surveyor'] as MembershipRole[])
          : user.roleHint === 'surveyor'
            ? (['surveyor'] as MembershipRole[])
            : (['client'] as MembershipRole[])));
    const staffRoles = roles.includes('admin') || merged.includes('admin')
      ? (Array.from(new Set([...roles, ...(merged.includes('admin') ? (['admin'] as AppRole[]) : [])])) as AppRole[])
      : roles;

    const staffLevel = (adminProfile?.staffLevel as StaffLevel | undefined) ?? null;
    const permissionPreset =
      (adminProfile?.permissionPreset as StaffPermissionPreset | undefined) ?? null;
    const storedPermissions = Array.isArray(adminProfile?.permissions)
      ? (adminProfile!.permissions as StaffPermission[])
      : [];
    const permissions =
      staffLevel != null
        ? resolveStaffPermissions({
            staffLevel,
            permissionPreset,
            permissions: storedPermissions,
          })
        : undefined;

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      avatarKey: user.avatarKey,
      onboardingStep: user.onboardingStep as OnboardingStep,
      accountType: user.accountType as AccountType,
      roleHint: hintFromMemberships(merged),
      memberships: merged,
      status: user.status as UserStatus,
      roles: staffRoles,
      staffLevel,
      permissionPreset,
      permissions,
    };
  }
}
