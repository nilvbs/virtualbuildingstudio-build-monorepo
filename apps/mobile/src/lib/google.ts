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
 * "Continue with Google" for mobile.
 *
 * In local dev (AUTH_DEV_MODE) the backend returns a start URL that already
 * carries the code + state, so we can exchange it directly without a browser
 * round-trip. Otherwise we open the provider in a secure auth session and read
 * the code/state back from the redirect.
 */
export async function signInWithGoogle(role: WorkspaceRole): Promise<GoogleOutcome> {
  const { url } = await api.googleStartUrl(role);

  let code: string | undefined;
  let state: string | undefined;

  const initial = Linking.parse(url);
  code = pickParam(initial.queryParams?.code);
  state = pickParam(initial.queryParams?.state);

  if (!code || !state) {
    const redirectUrl = Linking.createURL('auth-callback');
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
    if (result.type !== 'success' || !result.url) return { kind: 'cancelled' };
    const back = Linking.parse(result.url);
    code = pickParam(back.queryParams?.code);
    state = pickParam(back.queryParams?.state);
  }

  if (!code || !state) return { kind: 'cancelled' };

  const res = await api.exchangeGoogle({ code, state });
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
