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
    const value = this.config.get<string>(key);
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
      const { data } = await this.mgmt().users.create({
        connection: this.connection,
        email: input.email,
        password: input.password,
        name: input.fullName,
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
      if (status === 401 || status === 403) {
        throw new UnauthorizedException('Google sign-in was rejected');
      }
      this.logger.error('Auth0 authorization-code exchange failed', err as Error);
      throw err;
    }
  }
}
