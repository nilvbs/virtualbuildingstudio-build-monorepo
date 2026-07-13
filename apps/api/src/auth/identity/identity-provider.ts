import type { AuthSession } from '@surveylink/types';

export interface CreateIdentityInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface CreatedIdentity {
  /** Provider subject (e.g. Auth0 `user_id`) — stored as users.auth_subject. */
  subject: string;
  emailVerified: boolean;
}

export interface IdentityRecord {
  subject: string;
  email: string;
  emailVerified: boolean;
}

/** Input for building a social (OAuth authorization-code) authorize URL. */
export interface SocialAuthorizeInput {
  /** Where the provider redirects back to after consent (must be allow-listed). */
  redirectUri: string;
  /** Opaque state echoed back to the callback (carries role + CSRF nonce). */
  state: string;
  /** Provider connection name, e.g. `google-oauth2`. */
  connection: string;
}

/** Identity resolved from a social login (Google via the provider). */
export interface SocialIdentity {
  subject: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
}

export interface SocialExchangeInput {
  code: string;
  redirectUri: string;
}

export interface SocialExchangeResult {
  session: AuthSession;
  identity: SocialIdentity;
}

/**
 * Abstraction over the managed identity provider. Phase 1 ships an Auth0
 * implementation; keeping the boundary clean means the provider can be swapped
 * (or augmented) in Phase 2 without touching the auth service.
 */
export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');

export interface IdentityProvider {
  createIdentity(input: CreateIdentityInput): Promise<CreatedIdentity>;
  /** Resource-Owner-Password grant → token bundle. */
  login(email: string, password: string): Promise<AuthSession>;
  sendEmailVerification(subject: string): Promise<void>;
  getIdentity(subject: string): Promise<IdentityRecord>;
  /** Best-effort refresh-token revocation on logout. */
  revokeRefreshToken(refreshToken: string): Promise<void>;
  /** Build the provider authorize URL for a social (OAuth code) login. */
  buildSocialAuthorizeUrl(input: SocialAuthorizeInput): string;
  /** Exchange an authorization code for tokens + the resolved identity. */
  exchangeAuthorizationCode(input: SocialExchangeInput): Promise<SocialExchangeResult>;
}
