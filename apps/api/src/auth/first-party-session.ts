import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { AuthPrincipal, AuthSession } from '@surveylink/types';

/** Issuer claim for API-minted sessions (when Auth0 ROPG is unavailable). */
export const FIRST_PARTY_ISS = 'bld-api';
/** Audience claim for API-minted sessions. */
export const FIRST_PARTY_AUD = 'bld-session';

const DEFAULT_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function signingSecret(config: ConfigService): string | null {
  const dedicated = config.get<string>('SESSION_SIGNING_SECRET')?.trim();
  if (dedicated) return dedicated;
  // Staging always has the Auth0 app secret; reuse it so no new env is required.
  const fallback = config.get<string>('AUTH0_CLIENT_SECRET')?.trim();
  return fallback || null;
}

function signHs256(unsigned: string, secret: string): string {
  return createHmac('sha256', secret).update(unsigned).digest('base64url');
}

/**
 * Mint a bearer session the API accepts without Auth0 Resource Owner Password Grant.
 * Used right after we successfully set/create the Auth0 password (signup / link).
 */
export function issueFirstPartySession(
  config: ConfigService,
  input: {
    subject: string;
    email: string;
    emailVerified?: boolean;
    expiresInSec?: number;
  },
): AuthSession {
  const secret = signingSecret(config);
  if (!secret) {
    throw new Error('SESSION_SIGNING_SECRET or AUTH0_CLIENT_SECRET is required for first-party sessions');
  }
  const expiresIn = input.expiresInSec ?? DEFAULT_TTL_SEC;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: input.subject,
      email: input.email.trim().toLowerCase(),
      email_verified: Boolean(input.emailVerified),
      iss: FIRST_PARTY_ISS,
      aud: FIRST_PARTY_AUD,
      iat: now,
      exp: now + expiresIn,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const token = `${unsigned}.${signHs256(unsigned, secret)}`;
  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn,
  };
}

/** Verify an API-minted HS256 session token. Returns null when not ours / invalid. */
export function principalFromFirstPartyToken(
  token: string,
  config: ConfigService,
): AuthPrincipal | null {
  const secret = signingSecret(config);
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sig] = parts;
  const unsigned = `${headerB64}.${payloadB64}`;
  const expected = signHs256(unsigned, secret);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const json = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      iss?: string;
      aud?: string;
      exp?: number;
    };
    if (payload.iss !== FIRST_PARTY_ISS || payload.aud !== FIRST_PARTY_AUD) return null;
    if (!payload.sub) return null;
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
      roles: [],
    };
  } catch {
    return null;
  }
}

export function isAuth0GrantMisconfigured(message: string): boolean {
  return /unauthorized_client|grant type.*not allowed|password-realm|password realm/i.test(
    message,
  );
}
