import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { AppRole, AuthPrincipal, AuthSession } from '@surveylink/types';
import { APP_ROLES } from '@surveylink/types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEV_ACCESS_TOKEN,
  DEV_GOOGLE_ACCESS_TOKEN,
  DEV_GOOGLE_PRINCIPAL,
  DEV_PRINCIPAL,
  DEV_SUBJECT,
  devAuthEnabled,
  principalFromDevUserToken,
  principalFromUnsignedJwt,
} from '../dev-auth';
import { issueFirstPartySession, principalFromFirstPartyToken } from '../first-party-session';
import { IDENTITY_PROVIDER, type IdentityProvider } from '../identity/identity-provider';
import { StaffContextService } from '../staff-context.service';
import {
  ACCESS_COOKIE,
  OAUTH_NONCE_COOKIE,
  REFRESH_COOKIE,
  isCookieTransport,
  readCookie,
} from './session-cookies';
import { OAUTH_STATE_TTL_SEC } from './oauth-state';

const DEFAULT_ACCESS_TTL_SEC = 15 * 60;
const DEFAULT_REFRESH_TTL_SEC = 30 * 24 * 60 * 60;
/** Parallel tabs may present the same refresh token right after rotation. */
const ROTATION_GRACE_MS = 30_000;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

function positiveInt(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * API-owned sessions: every sign-in is converted into a short-lived first-party
 * access token plus a rotating, hashed refresh token. Web receives both as
 * httpOnly cookies; mobile receives them in the body for secure storage.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly staff: StaffContextService,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
  ) {}

  private get accessTtlSec(): number {
    return positiveInt(this.config.get('ACCESS_TOKEN_TTL_SEC'), DEFAULT_ACCESS_TTL_SEC);
  }

  private get refreshTtlSec(): number {
    return positiveInt(this.config.get('REFRESH_TOKEN_TTL_SEC'), DEFAULT_REFRESH_TTL_SEC);
  }

  private get secureCookies(): boolean {
    const explicit = String(this.config.get('COOKIE_SECURE') ?? '').trim().toLowerCase();
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    return String(this.config.get('NODE_ENV') ?? process.env.NODE_ENV ?? '').trim() === 'production';
  }

  private cookieBase(): CookieOptions {
    return { httpOnly: true, secure: this.secureCookies, path: '/' };
  }

  /**
   * Replace a provider/login session (Auth0, local verifier, dev) with an API
   * session. `upstream` must come from server-side sign-in, never from a client.
   */
  async issue(
    upstream: AuthSession,
    req: Request,
    res: Response,
    hint?: { email?: string },
  ): Promise<AuthSession> {
    const principal = this.principalFromUpstream(upstream.accessToken);
    if (principal && !principal.email) {
      const user = await this.prisma.user.findUnique({
        where: { authSubject: principal.sub },
        select: { email: true, emailVerified: true },
      });
      principal.email = user?.email ?? hint?.email;
      principal.emailVerified = principal.emailVerified ?? user?.emailVerified;
    }
    if (!principal?.email) {
      this.logger.warn('Could not derive principal from upstream session; passing it through');
      return this.deliverUpstream(upstream, req, res);
    }

    if (upstream.refreshToken) {
      void this.identity.revokeRefreshToken(upstream.refreshToken).catch(() => undefined);
    }

    const roles = await this.resolveRoles(principal.sub, principal.roles);
    const access = issueFirstPartySession(this.config, {
      subject: principal.sub,
      email: principal.email,
      emailVerified: principal.emailVerified,
      roles,
      expiresInSec: this.accessTtlSec,
    });
    const refreshToken = await this.createRefreshToken({
      subject: principal.sub,
      email: principal.email,
      familyId: randomUUID(),
      req,
    });
    return this.deliver(req, res, access, refreshToken, upstream.activeRole);
  }

  /** Rotate the presented refresh token (cookie for web, body for mobile). */
  async refresh(req: Request, res: Response, bodyToken?: string): Promise<AuthSession> {
    const cookieMode = isCookieTransport(req);
    const raw = cookieMode ? readCookie(req, REFRESH_COOKIE) : bodyToken;
    const fail = (message = 'Session expired'): never => {
      if (cookieMode) this.clearSessionCookies(res);
      throw new UnauthorizedException(message);
    };
    if (!raw) fail();

    const row = await this.prisma.authRefreshToken.findUnique({
      where: { tokenHash: hashToken(raw as string) },
    });
    if (!row || row.expiresAt.getTime() <= Date.now()) fail();
    const current = row!;

    if (current.revokedAt) {
      const withinGrace =
        current.replacedById !== null &&
        Date.now() - current.revokedAt.getTime() <= ROTATION_GRACE_MS;
      if (!withinGrace) {
        await this.revokeFamily(current.familyId);
        this.logger.warn(`Refresh token reuse detected for ${current.authSubject}; family revoked`);
        fail();
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { authSubject: current.authSubject },
      select: { email: true, emailVerified: true, status: true },
    });
    if (user && user.status !== 'active') {
      await this.revokeAllForSubject(current.authSubject);
      fail('Account is suspended');
    }

    const email = user?.email ?? current.email;
    const next = await this.createRefreshToken({
      subject: current.authSubject,
      email,
      familyId: current.familyId,
      req,
    });
    if (!current.revokedAt) {
      await this.prisma.authRefreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: next.id },
      });
    }

    const roles = await this.resolveRoles(current.authSubject, []);
    const access = issueFirstPartySession(this.config, {
      subject: current.authSubject,
      email,
      emailVerified: user?.emailVerified ?? false,
      roles,
      expiresInSec: this.accessTtlSec,
    });
    return this.deliver(req, res, access, next);
  }

  /** Revoke the presented refresh family and clear cookies. */
  async logout(req: Request, res: Response, bodyToken?: string): Promise<void> {
    const raw = isCookieTransport(req) ? readCookie(req, REFRESH_COOKIE) : bodyToken;
    if (raw) {
      const row = await this.prisma.authRefreshToken.findUnique({
        where: { tokenHash: hashToken(raw) },
        select: { familyId: true },
      });
      if (row) {
        await this.revokeFamily(row.familyId);
      } else {
        // Legacy provider refresh token from an older client.
        await this.identity.revokeRefreshToken(raw).catch(() => undefined);
      }
    }
    this.clearSessionCookies(res);
  }

  /** Sign out every device (suspension, password reset). */
  async revokeAllForSubject(subject: string): Promise<void> {
    await this.prisma.authRefreshToken.updateMany({
      where: { authSubject: subject, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  setOAuthNonceCookie(res: Response, nonce: string): void {
    res.cookie(OAUTH_NONCE_COOKIE, nonce, {
      ...this.cookieBase(),
      sameSite: 'lax',
      maxAge: OAUTH_STATE_TTL_SEC * 1000,
    });
  }

  clearOAuthNonceCookie(res: Response): void {
    res.clearCookie(OAUTH_NONCE_COOKIE, { ...this.cookieBase(), sameSite: 'lax' });
  }

  clearSessionCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { ...this.cookieBase(), sameSite: 'lax' });
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieBase(), sameSite: 'strict' });
  }

  private deliver(
    req: Request,
    res: Response,
    access: AuthSession,
    refresh: { token: string },
    activeRole?: AuthSession['activeRole'],
  ): AuthSession {
    if (isCookieTransport(req)) {
      res.cookie(ACCESS_COOKIE, access.accessToken, {
        ...this.cookieBase(),
        sameSite: 'lax',
        maxAge: access.expiresIn * 1000,
      });
      res.cookie(REFRESH_COOKIE, refresh.token, {
        ...this.cookieBase(),
        sameSite: 'strict',
        maxAge: this.refreshTtlSec * 1000,
      });
      return {
        accessToken: '',
        tokenType: 'Bearer',
        expiresIn: access.expiresIn,
        activeRole,
        transport: 'cookie',
      };
    }
    return {
      accessToken: access.accessToken,
      refreshToken: refresh.token,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
      activeRole,
      transport: 'bearer',
    };
  }

  private deliverUpstream(upstream: AuthSession, req: Request, res: Response): AuthSession {
    if (!isCookieTransport(req)) return { ...upstream, transport: 'bearer' };
    res.cookie(ACCESS_COOKIE, upstream.accessToken, {
      ...this.cookieBase(),
      sameSite: 'lax',
      maxAge: upstream.expiresIn * 1000,
    });
    return {
      accessToken: '',
      tokenType: 'Bearer',
      expiresIn: upstream.expiresIn,
      activeRole: upstream.activeRole,
      transport: 'cookie',
    };
  }

  private async createRefreshToken(input: {
    subject: string;
    email: string;
    familyId: string;
    req: Request;
  }): Promise<{ id: string; token: string }> {
    const token = randomBytes(32).toString('base64url');
    const userAgent = String(input.req.headers['user-agent'] ?? '').slice(0, 300) || null;
    const row = await this.prisma.authRefreshToken.create({
      data: {
        familyId: input.familyId,
        authSubject: input.subject,
        email: input.email.trim().toLowerCase(),
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + this.refreshTtlSec * 1000),
        userAgent,
        ip: input.req.ip ?? null,
      },
      select: { id: true },
    });
    return { id: row.id, token };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.authRefreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** `admin` only while the subject is active staff (or carried by the provider claim at sign-in). */
  private async resolveRoles(subject: string, claimed: AppRole[]): Promise<AppRole[]> {
    const roles = new Set<AppRole>(claimed.filter((r) => APP_ROLES.includes(r)));
    if (await this.staff.getBySubject(subject)) roles.add('admin');
    if (devAuthEnabled(this.config) && subject === DEV_SUBJECT) roles.add('admin');
    return Array.from(roles);
  }

  private principalFromUpstream(token: string): AuthPrincipal | null {
    if (!token) return null;
    if (devAuthEnabled(this.config)) {
      if (token === DEV_ACCESS_TOKEN) return DEV_PRINCIPAL;
      if (token === DEV_GOOGLE_ACCESS_TOKEN) return DEV_GOOGLE_PRINCIPAL;
      const dev = principalFromDevUserToken(token);
      if (dev) return dev;
    }
    const firstParty = principalFromFirstPartyToken(token, this.config);
    if (firstParty) return firstParty;

    // Provider token obtained server-to-server over TLS moments ago.
    const decoded = principalFromUnsignedJwt(token);
    if (!decoded) return null;
    const rolesClaim = this.config.get<string>('AUTH0_ROLES_CLAIM') ?? 'https://surveylink.app/roles';
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >;
      const raw = payload[rolesClaim];
      decoded.roles = Array.isArray(raw)
        ? raw.filter((r): r is AppRole => APP_ROLES.includes(r as AppRole))
        : [];
    } catch {
      decoded.roles = [];
    }
    return decoded;
  }
}
