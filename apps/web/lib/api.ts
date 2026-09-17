'use client';

import { createClient, ApiError } from '@surveylink/api-client';
import { clearSession, getToken } from './session';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let redirectingToLogin = false;

/** Clear the session and hard-navigate to the matching sign-in screen. */
export function redirectToLogin(): void {
  if (typeof window === 'undefined' || redirectingToLogin) return;
  redirectingToLogin = true;
  clearSession();
  const path = window.location.pathname;
  const target = path.startsWith('/build/admin')
    ? '/build/admin'
    : path.startsWith('/onboarding') || path.startsWith('/client') || path.startsWith('/surveyor')
      ? '/?auth=login'
      : '/login';
  window.location.assign(target);
}

/** Browser API client that attaches the current access token per-request. */
export const api = createClient({
  baseUrl,
  getAuthToken: () => getToken(),
  onUnauthorized: () => {
    redirectToLogin();
  },
});

export { ApiError };

/** Turns an unknown thrown value into a user-facing message. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string | string[] } | undefined;
    const msg = body?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg !== 'Unauthorized') {
      if (/^validation failed$/i.test(msg.trim())) {
        return 'Check your details and try again.';
      }
      return msg;
    }
    if (err.status === 401) {
      return 'Session expired or the API could not validate your sign-in. Sign out, sign in again, then retry.';
    }
    if (err.status === 503) {
      return typeof msg === 'string' && msg
        ? msg
        : 'A required service is not configured on the server yet.';
    }
    return `Request failed (${err.status}).`;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
