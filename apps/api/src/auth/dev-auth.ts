import type { ConfigService } from '@nestjs/config';
import type { AuthPrincipal } from '@surveylink/types';

/**
 * DEVELOPMENT-ONLY auth bypass.
 *
 * When AUTH_DEV_MODE=true (and NODE_ENV is not production), a single fixed
 * account can sign in without Auth0/Twilio, and its static bearer token is
 * accepted by the JWT guard. This exists purely to exercise the app locally
 * before the managed provider is configured. It is impossible to enable in
 * production and must never be relied on as a real auth mechanism.
 */
export const DEV_SUBJECT = 'dev|local';
export const DEV_EMAIL = 'dev@surveylink.local';
export const DEV_PASSWORD = 'devpass123';
export const DEV_ACCESS_TOKEN = 'dev-access-token';

export const DEV_PRINCIPAL: AuthPrincipal = {
  sub: DEV_SUBJECT,
  email: DEV_EMAIL,
  emailVerified: true,
  roles: ['admin'],
};

/**
 * A second fixed identity used to exercise the Google sign-in flow locally
 * (Auth0 is not configured in dev). It stands in for a brand-new social user
 * with no local account yet, so the "complete registration" step can be tested.
 */
export const DEV_GOOGLE_SUBJECT = 'dev|google';
export const DEV_GOOGLE_EMAIL = 'dev.google@surveylink.local';
export const DEV_GOOGLE_ACCESS_TOKEN = 'dev-google-access-token';
export const DEV_GOOGLE_CODE = 'dev-google';

export const DEV_GOOGLE_PRINCIPAL: AuthPrincipal = {
  sub: DEV_GOOGLE_SUBJECT,
  email: DEV_GOOGLE_EMAIL,
  emailVerified: true,
  roles: [],
};

export function devAuthEnabled(config: ConfigService): boolean {
  const nodeEnv = config.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
  if (nodeEnv === 'production') return false;
  return (config.get<string>('AUTH_DEV_MODE') ?? process.env.AUTH_DEV_MODE) === 'true';
}
