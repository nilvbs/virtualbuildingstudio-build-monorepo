import {
  ConflictException,
  Injectable,
  Logger,
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

export const AUTH_PROVIDER_NAME = 'auth0';
/** Auth provider label stored for accounts created through Google. */
export const GOOGLE_PROVIDER_NAME = 'google-oauth2';

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
export class Auth0IdentityProvider implements IdentityProvider {
  private readonly logger = new Logger(Auth0IdentityProvider.name);
  private authClient?: AuthenticationClient;
  private mgmtClient?: ManagementClient;

  constructor(private readonly config: ConfigService) {}

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

  async createIdentity(input: CreateIdentityInput): Promise<CreatedIdentity> {
    try {
      // Mark email verified in Auth0 so Resource Owner Password Grant can issue a
      // session immediately. Marketplace still runs its own email/phone OTP gates.
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
      return { subject: data.user_id, emailVerified: Boolean(data.email_verified) };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 409) {
        throw new ConflictException('An account with this email already exists');
      }
      this.logger.error('Failed to create Auth0 identity', err as Error);
      throw err;
    }
  }

  /**
   * Google-only (or social) accounts have no DB password. Creating a Username-
   * Password identity and linking it to the primary subject lets password signup
   * / login work alongside Google for the same marketplace user.
   */
  async ensurePasswordCredential(input: {
    email: string;
    password: string;
    primarySubject: string;
  }): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const primary = input.primarySubject.trim();
    if (!email || !input.password || !primary) {
      throw new UnauthorizedException('Could not enable password sign-in for this account');
    }

    // Already able to ROPG with this password → nothing to do.
    try {
      await this.login(email, input.password);
      return;
    } catch {
      /* continue — may need create / link / password update */
    }

    let dbUserId: string | undefined;
    try {
      const { data: byEmail } = await this.mgmt().usersByEmail.getByEmail({ email });
      const dbRow = (byEmail ?? []).find((u) =>
        (u.identities ?? []).some(
          (i) => i.provider === 'auth0' || i.connection === this.connection,
        ),
      );
      dbUserId = dbRow?.user_id ?? undefined;
    } catch (err) {
      this.logger.warn(
        `Auth0 users-by-email lookup failed for ${email}: ${(err as Error).message}`,
      );
    }

    if (dbUserId) {
      try {
        await this.mgmt().users.update({ id: dbUserId }, { password: input.password });
      } catch (err) {
        this.logger.error(`Failed to update Auth0 password for ${dbUserId}`, err as Error);
        throw new UnauthorizedException(
          'Could not set a password on this account. Try Sign in with Google, or Forgot password.',
        );
      }
      // Ensure linked to marketplace primary (idempotent when already linked).
      await this.linkDatabaseIdentity(primary, dbUserId);
      return;
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
        // Race: DB user appeared — retry login / update path once.
        try {
          await this.login(email, input.password);
          return;
        } catch {
          throw new ConflictException(
            'An account with this email already exists. Sign in with Google or use Forgot password.',
          );
        }
      }
      this.logger.error('Failed to create Auth0 password identity', err as Error);
      throw err;
    }

    await this.linkDatabaseIdentity(primary, dbUserId);
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
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 401 || status === 403) {
        throw new UnauthorizedException('Invalid email or password');
      }
      this.logger.error('Auth0 login failed', err as Error);
      throw err;
    }
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
