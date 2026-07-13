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
  AppRole,
  AuthenticatedUser,
  AuthPrincipal,
  AuthSession,
  GoogleAuthResult,
  MembershipRole,
  RoleHint,
  UserStatus,
  WorkspaceRole,
} from '@surveylink/types';
import { ROLE_HINTS } from '@surveylink/types';
import type {
  AddMembershipInput,
  CompleteRegistrationInput,
  SignupInput,
} from '@surveylink/validation';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IDENTITY_PROVIDER, type IdentityProvider } from './identity/identity-provider';
import { AUTH_PROVIDER_NAME, GOOGLE_PROVIDER_NAME } from './identity/auth0.identity-provider';
import { PHONE_VERIFIER, type PhoneVerifier } from './phone/phone-verifier';
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
    private readonly config: ConfigService,
  ) {}

  /**
   * Create the account on the identity provider and mirror it locally, then
   * kick off email + phone verification. The account is usable immediately;
   * verification only flips trust flags (required before a match is confirmed,
   * not before signup completes).
   */
  async signup(input: SignupInput): Promise<AuthenticatedUser> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { phone: input.phone }] },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('An account with this email or phone already exists');
    }

    const workspaceRole = input.roleHint as WorkspaceRole;

    if (devAuthEnabled(this.config)) {
      const subject = devSubjectForEmail(input.email);
      rememberDevSignup(input.email, input.password, subject);
      const user = await this.prisma.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          roleHint: workspaceRole,
          emailVerified: true,
          phoneVerified: true,
          authProvider: 'dev',
          authSubject: subject,
        },
      });
      await ensureMembership(this.prisma, user.id, workspaceRole);
      return this.toAuthenticatedUser(user, [], await listMemberships(this.prisma, user.id));
    }

    const identity = await this.identity.createIdentity({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      password: input.password,
    });

    const user = await this.prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        roleHint: workspaceRole,
        emailVerified: identity.emailVerified,
        authProvider: AUTH_PROVIDER_NAME,
        authSubject: identity.subject,
      },
    });
    await ensureMembership(this.prisma, user.id, workspaceRole);

    await Promise.allSettled([
      identity.emailVerified
        ? Promise.resolve()
        : this.identity.sendEmailVerification(identity.subject),
      this.phone.startVerification(input.phone),
    ]);

    return this.toAuthenticatedUser(user, [], await listMemberships(this.prisma, user.id));
  }

  async login(email: string, password: string, role?: WorkspaceRole): Promise<AuthSession> {
    let session: AuthSession;

    if (devAuthEnabled(this.config)) {
      if (email.trim().toLowerCase() === DEV_EMAIL && password === DEV_PASSWORD) {
        await this.ensureDevUser();
        session = {
          accessToken: DEV_ACCESS_TOKEN,
          tokenType: 'Bearer',
          expiresIn: 60 * 60 * 24,
        };
      } else {
        const local = findDevSignup(email);
        if (local && local.password === password) {
          session = {
            accessToken: issueDevUserToken(local.subject),
            tokenType: 'Bearer',
            expiresIn: 60 * 60 * 24,
          };
        } else {
          session = await this.identity.login(email, password);
        }
      }
    } else {
      session = await this.identity.login(email, password);
    }

    const user =
      (await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })) ??
      (await this.prisma.user.findUnique({ where: { email } }));
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
        return {
          session,
          registered: true,
          roleHint: existing.roleHint as RoleHint,
          profile: { email: existing.email, fullName: existing.fullName },
        };
      }
      return {
        session,
        registered: false,
        roleHint: role,
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
      return {
        session,
        registered: true,
        roleHint: existing.roleHint as RoleHint,
        profile: { email: existing.email, fullName: existing.fullName },
      };
    }

    // Account linking (same email, different provider) is out of scope for
    // Phase 1 — steer the user to their existing password login instead.
    if (identity.email) {
      const emailOwner = await this.prisma.user.findUnique({ where: { email: identity.email } });
      if (emailOwner) {
        throw new ConflictException(
          'An account with this email already exists. Please sign in with your email and password.',
        );
      }
    }

    return {
      session,
      registered: false,
      roleHint: role,
      profile: { email: identity.email, fullName: identity.fullName },
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

    const email = principal.email ?? input.email;
    if (!email) {
      throw new BadRequestException('Could not determine the account email from the identity');
    }

    const clash = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone: input.phone }] },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException('An account with this email or phone already exists');
    }

    const isDevGoogle = devAuthEnabled(this.config) && principal.sub === DEV_GOOGLE_SUBJECT;

    const workspaceRole = input.roleHint as WorkspaceRole;
    const user = await this.prisma.user.create({
      data: {
        fullName: input.fullName,
        email,
        phone: input.phone,
        roleHint: workspaceRole,
        // Social providers (Google) return already-verified emails.
        emailVerified: principal.emailVerified ?? true,
        authProvider: isDevGoogle ? 'dev' : GOOGLE_PROVIDER_NAME,
        authSubject: principal.sub,
      },
    });
    await ensureMembership(this.prisma, user.id, workspaceRole);

    // Best-effort, consistent with signup: a missing Twilio config must not fail this.
    await Promise.allSettled([this.phone.startVerification(input.phone)]);

    return this.toAuthenticatedUser(user, principal.roles, await listMemberships(this.prisma, user.id));
  }

  async addMembership(principal: AuthPrincipal, input: AddMembershipInput): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    await ensureMembership(this.prisma, user.id, input.role);
    const updated = await this.requireUser(principal.sub);
    return this.toAuthenticatedUser(updated, principal.roles, await listMemberships(this.prisma, updated.id));
  }

  async me(principal: AuthPrincipal): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    return this.toAuthenticatedUser(user, principal.roles, await listMemberships(this.prisma, user.id));
  }

  /** Re-sync email-verified status from the provider, resending if still unverified. */
  async verifyEmail(principal: AuthPrincipal): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    const identity = await this.identity.getIdentity(principal.sub);

    if (identity.emailVerified && !user.emailVerified) {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
      return this.hydrateUser(updated, principal.roles);
    }

    if (!identity.emailVerified) {
      await this.identity.sendEmailVerification(principal.sub);
    }
    return this.hydrateUser(user, principal.roles);
  }

  /** Confirm the SMS OTP for the authenticated user's phone number. */
  async verifyPhone(principal: AuthPrincipal, code: string): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    const approved = await this.phone.checkVerification(user.phone, code);
    if (!approved) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true },
    });
    return this.hydrateUser(updated, principal.roles);
  }

  private async requireUser(subject: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { authSubject: subject } });
    if (!user) {
      throw new NotFoundException('No local account is linked to this identity');
    }
    return user;
  }

  private async hydrateUser(user: User, roles: AppRole[]): Promise<AuthenticatedUser> {
    return this.toAuthenticatedUser(user, roles, await listMemberships(this.prisma, user.id));
  }

  private toAuthenticatedUser(
    user: User,
    roles: AppRole[],
    memberships: MembershipRole[] = [],
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
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      roleHint: hintFromMemberships(merged),
      memberships: merged,
      status: user.status as UserStatus,
      roles: staffRoles,
    };
  }
}
