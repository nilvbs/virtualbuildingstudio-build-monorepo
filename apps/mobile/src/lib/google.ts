import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { RoleHint, WorkspaceRole } from '@surveylink/types';
import { api } from './api';
import { setSession } from './session';

WebBrowser.maybeCompleteAuthSession();

export type GoogleOutcome =
  | { kind: 'authed'; role: WorkspaceRole }
  | { kind: 'needsRegistration'; email: string; fullName: string; roleHint: RoleHint }
  | { kind: 'cancelled' };

function pickParam(value: string | (string | null)[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.find((v): v is string => typeof v === 'string');
  return typeof value === 'string' ? value : undefined;
}

/**
 * Stable deep-link used as Auth0 `redirect_uri` for mobile.
 * Prefer the app scheme so Auth0 allow-list can stay fixed (`surveylink://auth-callback`).
 * Expo Go may still rewrite to `exp://…` — that URL must also be allow-listed.
 */
export function mobileGoogleRedirectUri(): string {
  return Linking.createURL('auth-callback', { scheme: 'surveylink' });
}

/**
 * "Continue with Google" for mobile.
 *
 * In local AUTH_DEV_MODE the API returns a start URL that already carries
 * code + state (no browser). Otherwise we open Auth0 and read code/state
 * from the mobile redirect deep link.
 */
export async function signInWithGoogle(role: WorkspaceRole): Promise<GoogleOutcome> {
  const redirectUri = mobileGoogleRedirectUri();
  if (__DEV__) {
    // Helpful when wiring Auth0 Allowed Callback URLs for Expo Go / device.
    console.log('[auth] Google redirectUri →', redirectUri);
  }

  const { url } = await api.googleStartUrl(role, redirectUri);

  let code: string | undefined;
  let state: string | undefined;

  const initial = Linking.parse(url);
  code = pickParam(initial.queryParams?.code);
  state = pickParam(initial.queryParams?.state);

  if (!code || !state) {
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
    if (result.type !== 'success' || !result.url) return { kind: 'cancelled' };
    const back = Linking.parse(result.url);
    code = pickParam(back.queryParams?.code);
    state = pickParam(back.queryParams?.state);
  }

  if (!code || !state) return { kind: 'cancelled' };

  const res = await api.exchangeGoogle({ code, state, redirectUri });
  await setSession({
    accessToken: res.session.accessToken,
    refreshToken: res.session.refreshToken,
    expiresAt: res.session.expiresIn ? Date.now() + res.session.expiresIn * 1000 : undefined,
    activeRole: res.session.activeRole ?? role,
  });

  if (res.registered) {
    return { kind: 'authed', role: res.session.activeRole ?? role };
  }
  return {
    kind: 'needsRegistration',
    email: res.profile.email,
    fullName: res.profile.fullName,
    roleHint: res.roleHint,
  };
}
