'use client';

import { createClient, ApiError } from '@surveylink/api-client';
import { getToken } from './session';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Browser API client that attaches the current access token per-request. */
export const api = createClient({
  baseUrl,
  getAuthToken: () => getToken(),
});

export { ApiError };

/** Turns an unknown thrown value into a user-facing message. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string | string[] } | undefined;
    const msg = body?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg !== 'Unauthorized') return msg;
    if (err.status === 401) {
      return 'Session expired or the API could not validate your sign-in. Sign out, sign in again, then retry.';
    }
    if (err.status === 503) return 'Auth is not configured yet on the server.';
    return `Request failed (${err.status}).`;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
