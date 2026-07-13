import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppRole,
  AuthenticatedUser,
  AuthPrincipal,
  AuthSession,
  RoleHint,
  UserStatus,
} from '@surveylink/types';
import type { SignupInput } from '@surveylink/validation';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IDENTITY_PROVIDER, type IdentityProvider } from './identity/identity-provider';
import { AUTH_PROVIDER_NAME } from './identity/auth0.identity-provider';
import { PHONE_VERIFIER, type PhoneVerifier } from './phone/phone-verifier';
import {
  DEV_ACCESS_TOKEN,
  DEV_EMAIL,
  DEV_PASSWORD,
  DEV_SUBJECT,
  devAuthEnabled,
} from './dev-auth';

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
        roleHint: input.roleHint,
        emailVerified: identity.emailVerified,
        authProvider: AUTH_PROVIDER_NAME,
        authSubject: identity.subject,
      },
    });

    // Fire-and-forget verifications; failures here must not fail signup.
    await Promise.allSettled([
      identity.emailVerified
        ? Promise.resolve()
        : this.identity.sendEmailVerification(identity.subject),
      this.phone.startVerification(input.phone),
    ]);

    return this.toAuthenticatedUser(user, []);
  }

  async login(email: string, password: string): Promise<AuthSession> {
    if (devAuthEnabled(this.config)) {
      if (email.trim().toLowerCase() === DEV_EMAIL && password === DEV_PASSWORD) {
        await this.ensureDevUser();
        return {
          accessToken: DEV_ACCESS_TOKEN,
          tokenType: 'Bearer',
          expiresIn: 60 * 60 * 24,
        };
      }
    }
    return this.identity.login(email, password);
  }

  /** Idempotently provision the fixed dev account (dev bypass only). */
  private async ensureDevUser(): Promise<void> {
    await this.prisma.user.upsert({
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
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.identity.revokeRefreshToken(refreshToken);
    }
  }

  async me(principal: AuthPrincipal): Promise<AuthenticatedUser> {
    const user = await this.requireUser(principal.sub);
    return this.toAuthenticatedUser(user, principal.roles);
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
      return this.toAuthenticatedUser(updated, principal.roles);
    }

    if (!identity.emailVerified) {
      await this.identity.sendEmailVerification(principal.sub);
    }
    return this.toAuthenticatedUser(user, principal.roles);
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
    return this.toAuthenticatedUser(updated, principal.roles);
  }

  private async requireUser(subject: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { authSubject: subject } });
    if (!user) {
      throw new NotFoundException('No local account is linked to this identity');
    }
    return user;
  }

  private toAuthenticatedUser(user: User, roles: AppRole[]): AuthenticatedUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      roleHint: user.roleHint as RoleHint,
      status: user.status as UserStatus,
      roles,
    };
  }
}
