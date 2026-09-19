import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
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
import type { AccountProfile } from '@prisma/client';
import { normalizeEmail } from '@surveylink/validation';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IDENTITY_PROVIDER, type IdentityProvider } from './identity/identity-provider';
import { AUTH_PROVIDER_NAME, GOOGLE_PROVIDER_NAME } from './identity/auth0.identity-provider';
import { PHONE_VERIFIER, type PhoneVerifier } from './phone/phone-verifier';
import { EMAIL_SENDER, type EmailSender } from '../notifications/delivery/email-sender';
import { buildWelcomeEmail } from '../notifications/delivery/welcome-email';
import { EmailOtpService } from './email/email-otp.service';
import { S3MediaStorageService } from '../media/s3-media.storage';
import {
  isAuth0GrantMisconfigured,
  issueFirstPartySession,
} from './first-party-session';
import { hashPassword, verifyPassword } from './password-verifier';
import { buildPersonNameFields, composeFullName, splitFullName } from './username';
import { AvatarStorageService } from './avatar-storage.service';
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
    @Inject(PHONE_VERIFIER) private readonly phone: PhoneVerifier,
    @Inject(EMAIL_SENDER) private readonly mail: EmailSender,
    private readonly emailOtp: EmailOtpService,
    private readonly config: ConfigService,
    private readonly media: S3MediaStorageService,
    private readonly avatarStorage: AvatarStorageService,
  ) {}

  /**
   * Create the account and issue a session. Email/phone OTPs are sent only when
   * the user requests them from onboarding Verify contact — not at signup.
   * A welcome email is attempted after a new account is created.
   */
  async signup(input: SignupInput): Promise<SignupResult> {
    const membershipRole = input.roleHint as MembershipRole;
    const legacyHint = membershipRole as WorkspaceRole;
    const email = normalizeEmail(input.email);

    // Prefer email: same person can register client + surveyor on one account.
    // Phone-only hits a *different* email → block (phone stays unique on users).
    const byEmail = await this.findUserByEmail(email);
    if (byEmail) {
      const { user, session, accountNotice } = await this.addRoleToExistingUser(
        byEmail,
        { ...input, email },
        membershipRole,
      );
      return {
        session: { ...session, activeRole: legacyHint },
        user,
        accountNotice,
      };
    }

    const phoneOwner = await this.prisma.user.findFirst({
      where: { phone: input.phone },
      select: { id: true, email: true },
    });
    if (phoneOwner) {
      throw new ConflictException(
        'That phone number is already used by another account. Use a different number, or sign in with the email on that account.',
      );
    }

    const names = await buildPersonNameFields(this.prisma, {
      firstName: input.firstName,
      lastName: input.lastName,
    });

    if (devAuthEnabled(this.config)) {
      const subject = devSubjectForEmail(email);
      rememberDevSignup(email, input.password, subject);
      const user = await this.prisma.user.create({
        data: {
          ...names,
          email,
          phone: input.phone,
          roleHint: legacyHint,
          accountType: input.accountType ?? 'individual',
          // Form signup must still verify email + phone via OTP (same as Auth0 path).
          emailVerified: false,
          phoneVerified: false,
          onboardingStep: 'select_account_type',
          authProvider: 'dev',
          authSubject: subject,
        },
      });
      await ensureMembership(this.prisma, user.id, membershipRole);
      // OTPs are requested from onboarding Verify contact — not here.
      void this.sendWelcomeEmail(email, names.fullName, membershipRole);
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
      fullName: names.fullName,
      email,
      phone: input.phone,
      password: input.password,
    });

    // Password signup verifies email + phone later on Verify contact.
    const user = await this.prisma.user.create({
      data: {
        ...names,
        email,
        phone: input.phone,
        roleHint: legacyHint,
        accountType: input.accountType ?? 'individual',
        emailVerified: false,
        // Account type is chosen on the first onboarding screen.
        onboardingStep: 'select_account_type',
        authProvider: AUTH_PROVIDER_NAME,
        authSubject: identity.subject,
      },
    });
    await ensureMembership(this.prisma, user.id, membershipRole);

    await this.persistPasswordVerifier(user.id, input.password);
    void this.sendWelcomeEmail(email, names.fullName, membershipRole);

    // Prefer Auth0 tokens; if password-realm is off, mint an API session so
    // Create account never strands the user (same outcome as Google OAuth).
    let session: AuthSession;
    try {
      session = await this.identity.login(email, input.password);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Signup Auth0 login failed for ${identity.subject} (${detail}); issuing first-party session`,
      );
      session = issueFirstPartySession(this.config, {
        subject: identity.subject,
        email,
        emailVerified: false,
      });
    }

    const hydrated = await this.hydrateUser(user, []);
    return {
      session: { ...session, activeRole: legacyHint },
      user: hydrated,
    };
  }

  /**
   * Attach another segregated role (client / surveyor / admin) to an existing
   * identity after verifying the password. Profile tables stay separate.
   *
   * Conflict only when that role is already on the account. Email match is enough
   * to add the other workspace — phone does not need to match (still unique overall).
   */
  private async addRoleToExistingUser(
    existing: User,
    input: SignupInput,
    membershipRole: MembershipRole,
  ): Promise<{
    user: AuthenticatedUser;
    session: AuthSession;
    accountNotice: SignupResult['accountNotice'];
  }> {
    this.assertUserActive(existing);
    const emailMatch = normalizeEmail(existing.email) === normalizeEmail(input.email);
    if (!emailMatch) {
      throw new ConflictException(
        'That phone number is already used by another account. Use a different number, or sign in with the email on that account.',
      );
    }

    const memberships = await listMemberships(this.prisma, existing.id);
    if (memberships.includes(membershipRole)) {
      const label = membershipRole === 'surveyor' ? 'Surveyor' : 'Client';
      throw new ConflictException(
        `An account with this email is already registered as a ${label}. Please sign in to continue.`,
      );
    }

    const existingMarketplace: 'client' | 'surveyor' | null = memberships.includes('client')
      ? 'client'
      : memberships.includes('surveyor')
        ? 'surveyor'
        : null;

    const session = await this.assertPasswordForUser(existing, input.password);
    await this.persistPasswordVerifier(existing.id, input.password);

    // Keepdev password map in sync when adding roles under AUTH_DEV_MODE.
    if (devAuthEnabled(this.config) && existing.authSubject) {
      rememberDevSignup(normalizeEmail(input.email), input.password, existing.authSubject);
    }

    // Only adopt the signup phone when the stored one is a placeholder (pending:/
    // clerk:/dev stubs). Never overwrite a real verified number — that felt like
    // a dual-role "reset" and cleared phoneVerified on every Create account.
    if (input.phone && this.isPlaceholderPhone(existing.phone) && input.phone !== existing.phone) {
      const phoneTaken = await this.prisma.user.findFirst({
        where: { phone: input.phone, NOT: { id: existing.id } },
        select: { id: true },
      });
      if (!phoneTaken) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { phone: input.phone, phoneVerified: false },
        });
      }
    }

    const refreshed = await this.attachMarketplaceRole(existing.id, membershipRole);
    const next = await listMemberships(this.prisma, existing.id);
    const user = await this.hydrateUser(refreshed, next.includes('admin') ? ['admin'] : []);

    const addedRole =
      membershipRole === 'client' || membershipRole === 'surveyor' ? membershipRole : null;
    const accountNotice =
      existingMarketplace && addedRole
        ? {
            kind: 'role_added' as const,
            existingRole: existingMarketplace,
            addedRole,
            message: this.dualRoleSignupMessage(existingMarketplace, addedRole),
          }
        : undefined;

    return { user, session, accountNotice };
  }

  /** Professional copy when Create account attaches a second marketplace workspace. */
  private dualRoleSignupMessage(
    existingRole: 'client' | 'surveyor',
    addedRole: 'client' | 'surveyor',
  ): string {
    const existingLabel = existingRole === 'client' ? 'Client' : 'Surveyor';
    const addedLabel = addedRole === 'client' ? 'Client' : 'Surveyor';
    return (
      `We recognized an existing BLD account for this email, currently set up as a ${existingLabel}. ` +
      `Your ${addedLabel} workspace has been added to the same profile. ` +
      `Verification and account details you already completed remain in place.`
    );
  }

  private async assertPasswordForUser(user: User, password: string): Promise<AuthSession> {
    // Google-only identities have no DB password yet — enable password sign-in
    // (Auth0 DB identity + link) so the user can add roles via Create account too.
    if (user.authProvider === GOOGLE_PROVIDER_NAME) {
      if (devAuthEnabled(this.config)) {
        if (user.authSubject) {
          rememberDevSignup(normalizeEmail(user.email), password, user.authSubject);
          return {
            accessToken: issueDevUserToken(user.authSubject),
            tokenType: 'Bearer',
            expiresIn: 60 * 60 * 24,
          };
        }
        throw new UnauthorizedException('This Google account is missing an identity link.');
      }
      if (!user.authSubject) {
        throw new UnauthorizedException('This Google account is missing an identity link.');
      }
      return this.identity.ensurePasswordCredential({
        email: normalizeEmail(user.email),
        password,
        primarySubject: user.authSubject,
      });
    }

    if (devAuthEnabled(this.config)) {
      if (normalizeEmail(user.email) === DEV_EMAIL && password === DEV_PASSWORD) {
        await this.ensureDevUser();
        return {
          accessToken: DEV_ACCESS_TOKEN,
          tokenType: 'Bearer',
          expiresIn: 60 * 60 * 24,
        };
      }
      const local = findDevSignup(user.email);
      if (local) {
        if (local.password !== password) {
          throw new UnauthorizedException(
            'Email already registered. Enter the same password as that account to add this role.',
          );
        }
        return {
          accessToken: issueDevUserToken(local.subject),
          tokenType: 'Bearer',
          expiresIn: 60 * 60 * 24,
        };
      }
      return this.loginLocalDevUser(user.email, password);
    }

    const email = normalizeEmail(user.email);
    try {
      return await this.identity.login(email, password);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);

      // Prefer the local verifier (same as staff / marketplace login fallback).
      const localSession = await this.tryLocalPasswordSession(user, password, detail);
      if (localSession) return localSession;

      // Auth0 password-realm is off and this account never got a local verifier
      // (created before that feature). Re-attach credentials so dual-role signup
      // can finish instead of dead-ending on a grant Auth0 won't issue.
      if (isAuth0GrantMisconfigured(detail) && user.authSubject && !user.passwordVerifier) {
        this.logger.warn(
          `Add-role Auth0 grant blocked for ${email} with no local verifier; syncing password credential`,
        );
        const session = await this.identity.ensurePasswordCredential({
          email,
          password,
          primarySubject: user.authSubject,
        });
        await this.persistPasswordVerifier(user.id, password);
        return session;
      }

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
      try {
        session = await this.identity.login(normalized, password);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        const local = await this.findUserByEmail(normalized);
        const localSession = await this.tryLocalPasswordSession(local, password, detail);
        if (localSession) {
          session = localSession;
        } else if (isAuth0GrantMisconfigured(detail)) {
          // Never surface Auth0 grant misconfig to the login form.
          throw new UnauthorizedException('Invalid email or password');
        } else if (err instanceof UnauthorizedException) {
          throw err;
        } else {
          throw new UnauthorizedException('Invalid email or password');
        }
      }
    }

    const user = await this.findUserByEmail(normalized);
    if (!user) {
      return session;
    }

    this.assertUserActive(user);

    await this.persistPasswordVerifier(user.id, password);

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

    // Google-only accounts can still request a reset once a DB password exists;
    // Auth0 no-ops / anti-enumerates when there is nothing to reset.
    if (devAuthEnabled(this.config)) {
      // Local bypass has no outbound email; keep response identical.
      return { ok: true, message };
    }

    await this.identity.requestPasswordReset(user.email);
    return { ok: true, message };
  }

  /** Persist scrypt verifier so login/signup sessions work without Auth0 ROPG. */
  private async persistPasswordVerifier(userId: string, password: string): Promise<void> {
    if (!password) return;
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordVerifier: hashPassword(password) },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to store password verifier for ${userId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * When Auth0 password-realm is blocked, accept the local verifier — or the
   * configured SUPER_ADMIN_* credentials for the bootstrap staff account.
   */
  private async tryLocalPasswordSession(
    user: User | null,
    password: string,
    auth0Detail: string,
  ): Promise<AuthSession | null> {
    if (!user?.authSubject) return null;

    if (verifyPassword(password, user.passwordVerifier)) {
      this.logger.warn(
        `Auth0 login failed for ${user.email}; using first-party session (${auth0Detail})`,
      );
      return issueFirstPartySession(this.config, {
        subject: user.authSubject,
        email: normalizeEmail(user.email),
        emailVerified: user.emailVerified,
      });
    }

    const superEmail = normalizeEmail(this.config.get<string>('SUPER_ADMIN_EMAIL') ?? '');
    const superPassword = this.config.get<string>('SUPER_ADMIN_PASSWORD') ?? '';
    if (
      superEmail &&
      superPassword &&
      normalizeEmail(user.email) === superEmail &&
      password === superPassword
    ) {
      this.logger.warn(
        `Auth0 login failed for super admin; syncing verifier and issuing first-party session`,
      );
      await this.persistPasswordVerifier(user.id, password);
      return issueFirstPartySession(this.config, {
        subject: user.authSubject,
        email: superEmail,
        emailVerified: true,
      });
    }

    return null;
  }

  /** Best-effort welcome note after Create account (never blocks signup). */
  private async sendWelcomeEmail(
    email: string,
    fullName: string,
    role: MembershipRole,
  ): Promise<void> {
    const content = buildWelcomeEmail({
      fullName,
      role,
      appUrl: this.webAppUrl,
    });
    try {
      await this.mail.send({
        to: email,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Welcome email skipped for ${email}: ${detail}`);
    }
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

  /** Phase 1: suspended (or otherwise non-active) accounts cannot authenticate. */
  private assertUserActive(user: Pick<User, 'status'>): void {
    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is suspended');
    }
  }

  private async ensureDevUser(): Promise<void> {
    const user = await this.prisma.user.upsert({
      where: { authSubject: DEV_SUBJECT },
      update: {},
      create: {
        firstName: 'Dev',
        lastName: 'Tester',
        fullName: 'Dev Tester',
        username: 'dev.tester',
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

  private isAllowedWebRedirect(candidate: string, parsed: URL): boolean {
    const allowed = new Set<string>([this.googleRedirectUri]);
    const extra = (this.config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean);
    for (const origin of extra) {
      allowed.add(`${origin}/auth/callback`);
    }
    if (allowed.has(candidate)) return true;

    const nodeEnv = String(this.config.get('NODE_ENV') ?? process.env.NODE_ENV ?? '').trim();
    const localHost =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (
      nodeEnv !== 'production' &&
      localHost &&
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.pathname === '/auth/callback'
    ) {
      return true;
    }
    return false;
  }

  /**
   * Web uses `{WEB_APP_URL}/auth/callback`. Mobile passes its deep link
   * (`surveylink://…` or Expo `exp://…`). Both must be listed in Auth0
   * Allowed Callback URLs.
   */
  private resolveOAuthRedirectUri(redirectUri?: string): string {
    const fallback = this.googleRedirectUri;
    const candidate = redirectUri?.trim();
    if (!candidate || candidate === fallback) return fallback;

    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new BadRequestException('Invalid OAuth redirectUri');
    }

    const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
    const allowedSchemes = new Set(['surveylink', 'exp', 'http', 'https']);
    if (!allowedSchemes.has(scheme)) {
      throw new BadRequestException('OAuth redirectUri scheme is not allowed');
    }

    // http(s) must match WEB_APP_URL, CORS_ORIGINS, or localhost in non-production.
    if (scheme === 'http' || scheme === 'https') {
      if (this.isAllowedWebRedirect(candidate, parsed)) return candidate;
      throw new BadRequestException('OAuth redirectUri is not allow-listed');
    }

    return candidate;
  }

  /** Build the URL the browser should navigate to for "Continue with Google". */
  startGoogleLogin(roleRaw: string | undefined, redirectUri?: string): { url: string } {
    const state = encodeState({ role: normalizeRole(roleRaw), nonce: randomBytes(12).toString('hex') });
    const resolvedRedirect = this.resolveOAuthRedirectUri(redirectUri);

    // Dev bypass: skip Auth0 entirely and bounce straight to the callback.
    if (devAuthEnabled(this.config)) {
      const params = new URLSearchParams({ code: DEV_GOOGLE_CODE, state });
      return { url: `${resolvedRedirect}?${params.toString()}` };
    }

    const connection = this.config.get<string>('AUTH0_GOOGLE_CONNECTION') ?? GOOGLE_CONNECTION;
    const url = this.identity.buildSocialAuthorizeUrl({
      redirectUri: resolvedRedirect,
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
  async exchangeGoogle(
    code: string,
    state: string,
    redirectUri?: string,
  ): Promise<GoogleAuthResult> {
    try {
      return await this.exchangeGoogleInner(code, state, redirectUri);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const prismaCode = (err as { code?: string }).code;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Google exchange failed${prismaCode ? ` [${prismaCode}]` : ''}: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      if (typeof prismaCode === 'string' && prismaCode.startsWith('P')) {
        throw new ServiceUnavailableException(
          `Sign-in failed due to a database error (${prismaCode}). Staging may need pending Prisma migrations.`,
        );
      }
      throw new ServiceUnavailableException(
        message.slice(0, 300) || 'Google sign-in failed unexpectedly',
      );
    }
  }

  private async exchangeGoogleInner(
    code: string,
    state: string,
    redirectUri?: string,
  ): Promise<GoogleAuthResult> {
    const { role } = decodeState(state);
    const workspaceRole: WorkspaceRole | undefined =
      role === 'client' || role === 'surveyor' ? role : undefined;
    const resolvedRedirect = this.resolveOAuthRedirectUri(redirectUri);

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
      redirectUri: resolvedRedirect,
    });

    const existing = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
    });
    if (existing) {
      return this.googleResultForExistingUser(existing, session, workspaceRole);
    }

    // Same Gmail already has a local row (password / older Auth0 subject): link
    // Google to that account so marketplace sign-in can continue with Google only.
    if (identity.email) {
      const emailOwner = await this.findUserByEmail(identity.email);
      if (emailOwner) {
        const linked = await this.prisma.user.update({
          where: { id: emailOwner.id },
          data: {
            authProvider: GOOGLE_PROVIDER_NAME,
            authSubject: identity.subject,
            emailVerified: emailOwner.emailVerified || Boolean(identity.email),
            fullName: emailOwner.fullName || identity.fullName || emailOwner.fullName,
          },
        });
        return this.googleResultForExistingUser(linked, session, workspaceRole);
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
   * Adding a new client/surveyor role keeps shared onboarding progress.
   */
  private async googleResultForExistingUser(
    existing: User,
    session: AuthSession,
    workspaceRole: WorkspaceRole | undefined,
  ): Promise<GoogleAuthResult> {
    this.assertUserActive(existing);
    let user = existing;
    if (workspaceRole) {
      user = await this.attachMarketplaceRole(existing.id, workspaceRole);
    }
    const memberships = await listMemberships(this.prisma, user.id);
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
      profile: { email: user.email, fullName: user.fullName },
    };
  }

  /**
   * Ensure marketplace membership exists. Client + surveyor share one identity —
   * never wipe terms / phone / onboarding when adding the second role (that made
   * surveyor login land on Terms after a partial client signup).
   *
   * If core onboarding is already done and the new role needs portfolio, advance
   * only that far.
   */
  private async attachMarketplaceRole(userId: string, role: MembershipRole): Promise<User> {
    const before = await listMemberships(this.prisma, userId);
    const isNew = !before.includes(role);
    await ensureMembership(this.prisma, userId, role);

    let user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    user = await this.healLegacyDualRoleWipe(user);
    if (!isNew || (role !== 'client' && role !== 'surveyor')) {
      return user;
    }

    const memberships = await listMemberships(this.prisma, userId);
    const coreDone =
      user.onboardingStep === 'done' ||
      (Boolean(user.accountTypeSelectedAt) &&
        Boolean(user.termsAcceptedAt) &&
        Boolean(user.ndaAcceptedAt) &&
        user.emailVerified &&
        user.phoneVerified);

    if (coreDone) {
      const needsPortfolio = await this.surveyorNeedsPortfolioStep(userId, memberships);
      if (needsPortfolio && (user.onboardingStep === 'done' || user.onboardingStep === 'portfolio')) {
        if (user.onboardingStep !== 'portfolio') {
          return this.prisma.user.update({
            where: { id: userId },
            data: { onboardingStep: 'portfolio' },
          });
        }
      }
      return user;
    }

    // Mid-onboarding: keep current step; membership alone is enough.
    return user;
  }

  /**
   * Older dual-role attach wiped terms + replaced the phone with pending:<id>.
   * That code is gone; repair leftover rows so users only re-enter a real phone.
   */
  private async healLegacyDualRoleWipe(user: User): Promise<User> {
    if (!this.isPlaceholderPhone(user.phone)) return user;
    const stuckEarly =
      !user.accountTypeSelectedAt ||
      !user.termsAcceptedAt ||
      !user.ndaAcceptedAt ||
      user.onboardingStep === 'select_account_type' ||
      user.onboardingStep === 'accept_terms';
    if (!stuckEarly) return user;

    const now = new Date();
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        accountTypeSelectedAt: user.accountTypeSelectedAt ?? now,
        termsAcceptedAt: user.termsAcceptedAt ?? now,
        ndaAcceptedAt: user.ndaAcceptedAt ?? now,
        onboardingStep:
          user.onboardingStep === 'done' || user.onboardingStep === 'portfolio'
            ? user.onboardingStep
            : 'verify_contact',
      },
    });
  }

  /**
   * Portfolio is required for first-time surveyors. If surveyor already existed
   * and the user is only adding client, skip portfolio after re-verify.
   */
  private async surveyorNeedsPortfolioStep(
    userId: string,
    memberships: MembershipRole[],
  ): Promise<boolean> {
    if (!memberships.includes('surveyor')) return false;
    if (!memberships.includes('client')) return true;

    const roles = await this.prisma.userRole.findMany({
      where: { userId, role: { in: ['client', 'surveyor'] } },
      orderBy: { createdAt: 'asc' },
      select: { role: true },
    });
    // Surveyor-first + later client → portfolio already done. Client-first + surveyor → need it.
    return roles[0]?.role !== 'surveyor';
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
    const names = await buildPersonNameFields(this.prisma, {
      firstName: input.firstName,
      lastName: input.lastName,
    });
    const user = await this.prisma.user.create({
      data: {
        ...names,
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

    // Phone OTP is sent from onboarding Verify contact when the user asks — not here.
    void this.sendWelcomeEmail(email, names.fullName, workspaceRole as MembershipRole);

    return this.hydrateUser(user, principal.roles);
  }

  async addMembership(principal: AuthPrincipal, input: AddMembershipInput): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    const updated = await this.attachMarketplaceRole(user.id, input.role);
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
    try {
      await this.emailOtp.start(user.id, user.email);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Email OTP send failed for ${user.email}: ${detail}`);
      throw new ServiceUnavailableException(
        detail.includes('not configured')
          ? 'Email delivery is not configured on the server yet. Ask an admin to set SendGrid keys.'
          : 'Could not send the verification email. Try again in a moment.',
      );
    }
    return { ok: true };
  }

  /** Send (or resend) a phone SMS OTP for the authenticated user. */
  async startPhoneVerification(
    principal: AuthPrincipal,
    phone?: string,
  ): Promise<{ ok: true; messageId?: string; skipped?: string }> {
    const user = await this.requireUser(principal.sub);
    if (user.phoneVerified) {
      return { ok: true, skipped: 'already_verified' };
    }

    let targetPhone = phone || user.phone;
    if (!targetPhone) {
      throw new BadRequestException('Enter a mobile number before sending an OTP');
    }
    if (phone && phone !== user.phone) {
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
      targetPhone = phone;
    }

    const sent = await this.phone.startVerification(user.id, targetPhone);
    return { ok: true, messageId: sent.messageId };
  }

  /** Confirm email OTP — both email and phone must be verified before profile. */
  async verifyEmail(principal: AuthPrincipal, code: string): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    const approved = await this.emailOtp.check(user.id, user.email, code);
    if (!approved) {
      throw new BadRequestException('Invalid or expired email verification code');
    }
    const withEmail = { ...user, emailVerified: true };
    const nextStep = this.stepAfterContactVerified(withEmail as User);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, onboardingStep: nextStep },
    });
    return this.hydrateUser(updated, principal.roles);
  }

  /** Confirm the SMS OTP — both email and phone must be verified before profile. */
  async verifyPhone(principal: AuthPrincipal, code: string): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    const approved = await this.phone.checkVerification(user.id, user.phone, code);
    if (!approved) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }
    const withPhone = { ...user, phoneVerified: true };
    const nextStep = this.stepAfterContactVerified(withPhone as User);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true, onboardingStep: nextStep },
    });
    return this.hydrateUser(updated, principal.roles);
  }

  async getOnboarding(principal: AuthPrincipal): Promise<OnboardingStatus> {
    const user = await this.requireUser(principal.sub);
    const memberships = await listMemberships(this.prisma, user.id);
    const accountProfile = await this.prisma.accountProfile.findUnique({
      where: { userId: user.id },
    });
    const requiresPortfolio = await this.surveyorNeedsPortfolioStep(user.id, memberships);
    return this.toOnboardingStatus(user, memberships, accountProfile, requiresPortfolio);
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
    const namePatch =
      input.fullName !== undefined ? this.nameFieldsFromFullName(input.fullName) : {};

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...namePatch,
        ...(input.avatarKey !== undefined ? { avatarKey: input.avatarKey } : {}),
      },
    });

    const profilePatch = {
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.registrationNumber !== undefined
        ? { registrationNumber: input.registrationNumber?.trim() || null }
        : {}),
      ...(input.website !== undefined ? { website: input.website?.trim() || null } : {}),
      ...(input.address
        ? {
            addressLine1: input.address.line1,
            addressLine2: input.address.line2?.trim() ? input.address.line2.trim() : null,
            city: input.address.city,
            state: input.address.state,
            postalCode: input.address.postalCode,
            country: input.address.country,
          }
        : {}),
    };

    if (Object.keys(profilePatch).length > 0) {
      await this.prisma.accountProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...profilePatch },
        update: profilePatch,
      });
    }

    return this.hydrateUser(updated, principal.roles);
  }

  /**
   * Upload a new profile photo, persist its S3 URL, then delete the previous
   * object from S3 (best-effort) so only the latest avatar remains.
   */
  async replaceAvatar(
    principal: AuthPrincipal,
    file: Express.Multer.File,
  ): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    const previous = user.avatarKey;
    const avatarKey = await this.avatarStorage.save(principal.sub, file);
    const updated = await this.updateMe(principal, { avatarKey });
    if (previous && previous !== avatarKey) {
      await this.media.deleteStoredObject(previous, principal.sub);
    }
    return updated;
  }

  /**
   * Finish personal profile. Surveyors advance to portfolio builder; clients to done.
   * Email and phone must both be verified first.
   */
  async completeProfile(
    principal: AuthPrincipal,
    input: CompleteProfileInput,
  ): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    if (!user.termsAcceptedAt || !user.ndaAcceptedAt) {
      throw new BadRequestException('Accept the Terms & Conditions and NDA before continuing');
    }
    if (!user.emailVerified) {
      throw new BadRequestException('Verify your email before completing your profile');
    }
    if (!user.phoneVerified) {
      throw new BadRequestException('Verify your mobile number before completing your profile');
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
    const requiresPortfolio = await this.surveyorNeedsPortfolioStep(user.id, memberships);
    const nextStep: OnboardingStep = requiresPortfolio ? 'portfolio' : 'done';

    const website = input.website?.trim() ? input.website.trim() : null;
    const addressData = {
      addressLine1: input.address.line1,
      addressLine2: input.address.line2?.trim() ? input.address.line2.trim() : null,
      city: input.address.city,
      state: input.address.state,
      postalCode: input.address.postalCode,
      country: input.address.country,
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
    };
    const companyData = isCompany
      ? { registrationNumber: input.registrationNumber!.trim(), website }
      : {};

    await this.prisma.accountProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...addressData, ...companyData },
      update: { ...addressData, ...companyData },
    });

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(input.fullName !== undefined ? this.nameFieldsFromFullName(input.fullName) : {}),
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

  /** After Terms & NDA: email + phone verification are required before profile. */
  private stepAfterTermsAccepted(_user: User): OnboardingStep {
    return 'verify_contact';
  }

  /** Internal stubs used when phone is required/unique but not collected yet. */
  private isPlaceholderPhone(phone: string | null | undefined): boolean {
    if (!phone) return true;
    if (phone === '+10000000001' || phone === '+1') return true;
    if (phone.startsWith('pending:') || phone.startsWith('clerk:')) return true;
    if (/^\+1555010\d{3}$/.test(phone)) return true;
    return phone.length < 10;
  }

  /**
   * Derive the step clients should see. Prefer stored progress, but never send
   * someone back to account-type/terms when those gates are already satisfied
   * (can happen after older dual-role resets left step lagging behind facts).
   */
  private resolveOnboardingStep(user: User): OnboardingStep {
    const stored = user.onboardingStep as OnboardingStep;
    if (stored === 'done') return 'done';

    if (!user.accountTypeSelectedAt) {
      // Gate only when still on/before account type — don't clobber later steps.
      if (!stored || stored === 'select_account_type') return 'select_account_type';
      return stored;
    }

    if (user.termsAcceptedAt && user.ndaAcceptedAt) {
      if (stored === 'select_account_type' || stored === 'accept_terms') {
        return this.contactsVerified(user) ? 'complete_profile' : 'verify_contact';
      }
      // Heal: never leave someone on profile/portfolio while contact is incomplete.
      if (
        (stored === 'complete_profile' || stored === 'portfolio') &&
        !this.contactsVerified(user)
      ) {
        return 'verify_contact';
      }
    }

    return stored;
  }

  /** Signup email + mobile must both be verified to leave Verify contact. */
  private contactsVerified(user: Pick<User, 'emailVerified' | 'phoneVerified'>): boolean {
    return user.emailVerified && user.phoneVerified;
  }

  private stepAfterContactVerified(user: User): OnboardingStep {
    if (!this.contactsVerified(user)) {
      const current = user.onboardingStep as OnboardingStep;
      if (current === 'verify_contact' || current === 'complete_profile' || current === 'portfolio') {
        return 'verify_contact';
      }
      return current;
    }
    const current = user.onboardingStep as OnboardingStep;
    if (current === 'verify_contact') return 'complete_profile';
    return current;
  }

  private toOnboardingStatus(
    user: User,
    memberships: MembershipRole[],
    accountProfile: AccountProfile | null,
    requiresPortfolio = memberships.includes('surveyor'),
  ): OnboardingStatus {
    const pendingContact = !user.emailVerified
      ? user.phoneVerified
        ? 'email'
        : 'both'
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
      !user.phoneVerified && this.isPlaceholderPhone(user.phone);

    const effectiveStep = this.resolveOnboardingStep(user);

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
      canCompleteProfile: this.contactsVerified(user),
      pendingContact,
      requiresPortfolio,
      avatarKey: this.media.resolveSignedUrl(user.avatarKey),
      fullName: user.fullName,
      companyName: accountProfile?.companyName ?? null,
      address,
      workEmail: accountProfile?.workEmail ?? null,
      workEmailVerified: accountProfile?.workEmailVerified ?? false,
      registrationNumber: accountProfile?.registrationNumber ?? null,
      website: accountProfile?.website ?? null,
    };
  }

  private nameFieldsFromFullName(fullName: string): {
    firstName: string;
    lastName: string;
    fullName: string;
  } {
    const { firstName, lastName } = splitFullName(fullName);
    return {
      firstName: firstName || 'User',
      lastName,
      fullName: composeFullName(firstName || 'User', lastName),
    };
  }

  private async requireUser(subject: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { authSubject: subject } });
    if (!user) {
      throw new NotFoundException('No local account is linked to this identity');
    }
    return this.healLegacyDualRoleWipe(user);
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
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      avatarKey: this.media.resolveSignedUrl(user.avatarKey),
      onboardingStep: this.resolveOnboardingStep(user),
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
