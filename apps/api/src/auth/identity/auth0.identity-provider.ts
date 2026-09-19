import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticationClient, ManagementClient } from 'auth0';
import type { AuthSession } from '@surveylink/types';
import type {
  CreatedIdentity,
  CreateIdentityInput,
  IdentityProvider,
  IdentityRecord,
  SocialAuthorizeInput,
  SocialExchangeInput,
  SocialExchangeResult,
  SocialIdentity,
} from './identity-provider';
import {
  isAuth0GrantMisconfigured,
  issueFirstPartySession,
} from '../first-party-session';

export const AUTH_PROVIDER_NAME = 'auth0';
/** Auth provider label stored for accounts created through Google. */
export const GOOGLE_PROVIDER_NAME = 'google-oauth2';

/** Grants required for email/password signup + login (same app Google already uses). */
const PASSWORD_GRANTS = [
  'password',
  'http://auth0.com/oauth/grant-type/password-realm',
] as const;

interface Auth0IdToken {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
}

/** Decode a JWT payload without verifying its signature. Safe here because the
 *  token is received directly from Auth0's token endpoint over TLS. */
function decodeJwtPayload(token: string): Auth0IdToken {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  const json = Buffer.from(parts[1], 'base64url').toString('utf8');
  try {
    return JSON.parse(json) as Auth0IdToken;
  } catch {
    return {};
  }
}

@Injectable()
export class Auth0IdentityProvider implements IdentityProvider, OnModuleInit {
  private readonly logger = new Logger(Auth0IdentityProvider.name);
  private authClient?: AuthenticationClient;
  private mgmtClient?: ManagementClient;
  private grantsEnsured = false;
  private grantsOk = false;

  constructor(private readonly config: ConfigService) {}

  /**
   * Best-effort: enable Password + Password Realm on the Auth0 app so form
   * signup can get tokens the same way Google uses Authorization Code.
   * Never blocks boot — first-party sessions cover failures.
   */
  async onModuleInit(): Promise<void> {
    try {
      if (!this.config.get<string>('AUTH0_DOMAIN')?.trim()) return;
      if (!this.config.get<string>('AUTH0_MGMT_CLIENT_ID')?.trim()) return;
      await this.ensurePasswordGrants();
    } catch (err) {
      this.logger.warn(
        `Auth0 password-grant bootstrap skipped: ${(err as Error).message}`,
      );
    }
  }

  private get domain(): string {
    return this.requireConfig('AUTH0_DOMAIN');
  }

  private get audience(): string {
    return this.requireConfig('AUTH0_AUDIENCE');
  }

  private get connection(): string {
    return this.config.get<string>('AUTH0_DB_CONNECTION') ?? 'Username-Password-Authentication';
  }

  private requireConfig(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) {
      throw new ServiceUnavailableException(`Auth is not configured: missing ${key}`);
    }
    return value;
  }

  private auth(): AuthenticationClient {
    if (!this.authClient) {
      this.authClient = new AuthenticationClient({
        domain: this.domain,
        clientId: this.requireConfig('AUTH0_CLIENT_ID'),
        clientSecret: this.requireConfig('AUTH0_CLIENT_SECRET'),
      });
    }
    return this.authClient;
  }

  private mgmt(): ManagementClient {
    if (!this.mgmtClient) {
      this.mgmtClient = new ManagementClient({
        domain: this.domain,
        clientId: this.requireConfig('AUTH0_MGMT_CLIENT_ID'),
        clientSecret: this.requireConfig('AUTH0_MGMT_CLIENT_SECRET'),
      });
    }
    return this.mgmtClient;
  }

  /**
   * Ensure the Auth0 application allows Resource Owner Password Grant.
   * Returns true when grants are present (already or after patch).
   */
  async ensurePasswordGrants(): Promise<boolean> {
    if (this.grantsOk) return true;
    if (this.grantsEnsured) return this.grantsOk;
    this.grantsEnsured = true;

    const clientId = this.requireConfig('AUTH0_CLIENT_ID');
    try {
      const { data: app } = await this.mgmt().clients.get({ client_id: clientId });
      const before = [...(app.grant_types ?? [])];
      const after = [
        ...new Set([...before, ...PASSWORD_GRANTS, 'refresh_token', 'authorization_code']),
      ];
      const missing = PASSWORD_GRANTS.filter((g) => !before.includes(g));
      if (missing.length === 0) {
        this.grantsOk = true;
        this.logger.log('Auth0 password grants already enabled');
        return true;
      }

      await this.mgmt().clients.update({ client_id: clientId }, { grant_types: after });
      this.grantsOk = true;
      this.logger.log(
        `Enabled Auth0 grant(s) on app ${clientId.slice(0, 8)}…: ${missing.join(', ')}`,
      );
      return true;
    } catch (err) {
      this.logger.warn(
        `Could not enable Auth0 password grants (need update:clients on M2M): ${(err as Error).message}`,
      );
      this.grantsOk = false;
      return false;
    }
  }

  private async passwordGrant(email: string, password: string): Promise<AuthSession> {
    const { data } = await this.auth().oauth.passwordGrant({
      username: email,
      password,
      realm: this.connection,
      audience: this.audience,
      scope: 'openid profile email offline_access',
    });
    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type ?? 'Bearer',
      expiresIn: data.expires_in,
    };
  }

  async createIdentity(input: CreateIdentityInput): Promise<CreatedIdentity> {
    try {
      // Auth0 marks email_verified for ROPG login only. Marketplace still requires
      // its own email OTP, so we report emailVerified: false to the app layer.
      const { data } = await this.mgmt().users.create({
        connection: this.connection,
        email: input.email,
        password: input.password,
        name: input.fullName,
        email_verified: true,
        verify_email: false,
      });
      if (!data.user_id) {
        throw new ServiceUnavailableException('Auth0 did not return a user id');
      }
      return { subject: data.user_id, emailVerified: false };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 409) {
        throw new ConflictException('An account with this email already exists');
      }
      this.logger.error('Failed to create Auth0 identity', err as Error);
      throw err;
    }
  }

  async findIdentityByEmail(email: string): Promise<CreatedIdentity | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    try {
      const { data } = await this.mgmt().usersByEmail.getByEmail({ email: normalized });
      if (!data?.length) return null;
      const db = data.find((u) => (u.user_id ?? '').startsWith('auth0|'));
      const hit = db ?? data[0];
      if (!hit?.user_id) return null;
      return {
        subject: hit.user_id,
        emailVerified: Boolean(hit.email_verified),
      };
    } catch (err) {
      this.logger.warn(
        `Auth0 users-by-email failed for ${normalized}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Google-only (or social) accounts have no DB password. Creating a Username-
   * Password identity and linking it to the primary subject lets password signup
   * / login work alongside Google for the same marketplace user.
   * Returns a session after password is set — prefers Auth0 ROPG, falls back
   * to an API-minted session when password-realm is disabled on the Auth0 app.
   */
  async ensurePasswordCredential(input: {
    email: string;
    password: string;
    primarySubject: string;
  }): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    const primary = input.primarySubject.trim();
    if (!email || !input.password || !primary) {
      throw new UnauthorizedException('Could not enable password sign-in for this account');
    }

    // Already able to ROPG with this password → done.
    try {
      return await this.login(email, input.password);
    } catch {
      /* continue — may need create / link / password update */
    }

    let dbUserId = await this.findDatabaseUserId(email);

    if (dbUserId) {
      try {
        await this.mgmt().users.update({ id: dbUserId }, { password: input.password });
      } catch (err) {
        this.logger.error(`Failed to update Auth0 password for ${dbUserId}`, err as Error);
        throw new UnauthorizedException(
          'Could not set a password on this account. Try Sign in with Google, or Forgot password.',
        );
      }
      await this.linkDatabaseIdentity(primary, dbUserId);
      return this.loginAfterPasswordSetup(email, input.password, primary);
    }

    try {
      const { data } = await this.mgmt().users.create({
        connection: this.connection,
        email,
        password: input.password,
        email_verified: true,
        verify_email: false,
      });
      if (!data.user_id) {
        throw new ServiceUnavailableException('Auth0 did not return a user id');
      }
      dbUserId = data.user_id;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 409) {
        dbUserId = await this.findDatabaseUserId(email);
        if (dbUserId) {
          await this.mgmt().users.update({ id: dbUserId }, { password: input.password });
          await this.linkDatabaseIdentity(primary, dbUserId);
          return this.loginAfterPasswordSetup(email, input.password, primary);
        }
        throw new ConflictException(
          'An account with this email already exists. Sign in with Google or use Forgot password.',
        );
      }
      this.logger.error('Failed to create Auth0 password identity', err as Error);
      throw err;
    }

    await this.linkDatabaseIdentity(primary, dbUserId);
    return this.loginAfterPasswordSetup(email, input.password, primary);
  }

  /** Prefer the auth0| user id, not the Google primary row from users-by-email. */
  private async findDatabaseUserId(email: string): Promise<string | undefined> {
    try {
      const { data: byEmail } = await this.mgmt().usersByEmail.getByEmail({ email });
      for (const u of byEmail ?? []) {
        if (u.user_id?.startsWith('auth0|')) return u.user_id;
        const auth0Identity = (u.identities ?? []).find(
          (i) => i.provider === 'auth0' || i.connection === this.connection,
        );
        if (auth0Identity?.user_id) {
          const raw = String(auth0Identity.user_id);
          return raw.startsWith('auth0|') ? raw : `auth0|${raw}`;
        }
      }
    } catch (err) {
      this.logger.warn(
        `Auth0 users-by-email lookup failed for ${email}: ${(err as Error).message}`,
      );
    }
    return undefined;
  }

  private async loginAfterPasswordSetup(
    email: string,
    password: string,
    subjectForSession: string,
  ): Promise<AuthSession> {
    try {
      return await this.login(email, password);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Auth0 password grant failed after setup for ${email} (${detail}); issuing first-party session`,
      );
      // Password was just written via Management API — trust it and mint our session
      // so create-account / add-role never dead-ends on missing password-realm grants.
      return issueFirstPartySession(this.config, {
        subject: subjectForSession,
        email,
        emailVerified: true,
      });
    }
  }

  private async linkDatabaseIdentity(primarySubject: string, dbUserId: string): Promise<void> {
    if (!primarySubject || !dbUserId || primarySubject === dbUserId) return;
    // Linking is only needed when primary is social (google-oauth2|…).
    if (primarySubject.startsWith('auth0|')) return;

    const secondaryId = dbUserId.startsWith('auth0|')
      ? dbUserId.slice('auth0|'.length)
      : dbUserId;

    try {
      await this.mgmt().users.link(
        { id: primarySubject },
        { provider: 'auth0', user_id: secondaryId },
      );
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      const msg = (err as Error).message ?? '';
      // Already linked / identity exists — treat as success.
      if (status === 409 || /already/i.test(msg)) {
        this.logger.warn(`Auth0 link skipped for ${primarySubject}: ${msg}`);
        return;
      }
      this.logger.error(
        `Failed to link Auth0 DB identity ${dbUserId} → ${primarySubject}`,
        err as Error,
      );
      throw new ServiceUnavailableException(
        'Password was set but could not be linked to this Google account. Try Sign in with Google.',
      );
    }
  }

  async login(email: string, password: string): Promise<AuthSession> {
    try {
      return await this.passwordGrant(email, password);
    } catch (err) {
      const detail = auth0ErrorMessage(err);
      // If Password Realm is off, try enabling it once then retry — matches Google’s
      // “just works” path when Management API has update:clients.
      if (isAuth0GrantMisconfigured(detail)) {
        const enabled = await this.ensurePasswordGrants();
        if (enabled) {
          try {
            return await this.passwordGrant(email, password);
          } catch (retryErr) {
            return this.mapLoginError(retryErr);
          }
        }
      }
      return this.mapLoginError(err);
    }
  }

  private mapLoginError(err: unknown): never {
    const status = (err as { statusCode?: number }).statusCode;
    const detail = auth0ErrorMessage(err);
    if (status === 401 || status === 403) {
      if (/unauthorized_client|grant|realm|password/i.test(detail)) {
        throw new UnauthorizedException(detail);
      }
      throw new UnauthorizedException('Invalid email or password');
    }
    this.logger.error(`Auth0 login failed: ${detail}`, err as Error);
    throw err instanceof Error ? err : new UnauthorizedException(detail);
  }

  async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.auth().database.changePassword({
        email,
        connection: this.connection,
      });
    } catch (err) {
      // Auth0 still returns success for unknown emails; treat other errors as
      // soft failures so the API can keep anti-enumeration behaviour.
      this.logger.warn(`Auth0 password-reset request failed for ${email}: ${(err as Error).message}`);
    }
  }

  /**
   * Set the Auth0 DB password for this email (create/link if Google-only).
   * Does not return a session — used by first-party reset-password links.
   */
  async setPassword(input: {
    email: string;
    password: string;
    primarySubject: string;
  }): Promise<void> {
    await this.ensurePasswordCredential(input);
  }

  async sendEmailVerification(subject: string): Promise<void> {
    await this.mgmt().jobs.verifyEmail({ user_id: subject });
  }

  async getIdentity(subject: string): Promise<IdentityRecord> {
    const { data } = await this.mgmt().users.get({ id: subject });
    return {
      subject: data.user_id ?? subject,
      email: data.email ?? '',
      emailVerified: Boolean(data.email_verified),
    };
  }

  async deleteIdentity(subject: string): Promise<void> {
    if (!subject.trim()) return;
    try {
      await this.mgmt().users.delete({ id: subject });
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404) return;
      this.logger.warn(
        `Auth0 identity delete failed for ${subject}: ${(err as Error).message}`,
      );
    }
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      await this.auth().oauth.revokeRefreshToken({ token: refreshToken });
    } catch (err) {
      // Logout should be resilient; a failed revoke must not block the client.
      this.logger.warn(`Refresh-token revoke failed: ${(err as Error).message}`);
    }
  }

  buildSocialAuthorizeUrl(input: SocialAuthorizeInput): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.requireConfig('AUTH0_CLIENT_ID'),
      connection: input.connection,
      redirect_uri: input.redirectUri,
      scope: 'openid profile email offline_access',
      audience: this.audience,
      state: input.state,
    });
    return `https://${this.domain}/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(input: SocialExchangeInput): Promise<SocialExchangeResult> {
    try {
      const { data } = await this.auth().oauth.authorizationCodeGrant({
        code: input.code,
        redirect_uri: input.redirectUri,
      });
      const claims = data.id_token ? decodeJwtPayload(data.id_token) : {};
      const composedName = [claims.given_name, claims.family_name].filter(Boolean).join(' ');
      const identity: SocialIdentity = {
        subject: claims.sub ?? '',
        email: claims.email ?? '',
        emailVerified: Boolean(claims.email_verified),
        fullName: claims.name || composedName || claims.email || '',
      };
      if (!identity.subject) {
        throw new ServiceUnavailableException('Auth0 did not return an identity subject');
      }
      return {
        session: {
          accessToken: data.access_token,
          idToken: data.id_token,
          refreshToken: data.refresh_token,
          tokenType: data.token_type ?? 'Bearer',
          expiresIn: data.expires_in,
        },
        identity,
      };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      const auth0Msg = auth0ErrorMessage(err);
      this.logger.error(
        `Auth0 authorization-code exchange failed (status=${status ?? 'n/a'}): ${auth0Msg}`,
        err instanceof Error ? err.stack : undefined,
      );
      // Always surface Auth0's reason (redirect_uri mismatch, unauthorized
      // client, invalid_grant, etc.) instead of Nest's blank 500.
      throw new UnauthorizedException(auth0Msg);
    }
  }
}

/** Pull a human-readable message out of Auth0 SDK / OAuth error shapes. */
function auth0ErrorMessage(err: unknown): string {
  const e = err as {
    error_description?: string;
    error?: string;
    message?: string;
    body?: unknown;
  };
  const fromBody = messageFromAuth0Body(e.body);
  if (fromBody) return fromBody;
  if (typeof e.error_description === 'string' && e.error_description.trim()) {
    return e.error_description.trim();
  }
  if (typeof e.message === 'string' && e.message.trim()) return e.message.trim();
  if (typeof e.error === 'string' && e.error.trim()) return e.error.trim();
  return 'Auth0 token exchange failed';
}

function messageFromAuth0Body(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body === 'object') {
    const o = body as Record<string, unknown>;
    for (const key of ['error_description', 'message', 'error'] as const) {
      const v = o[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  }
  if (typeof body !== 'string' || !body.trim()) return null;
  try {
    return messageFromAuth0Body(JSON.parse(body) as unknown) ?? body.slice(0, 300);
  } catch {
    return body.slice(0, 300);
  }
}
