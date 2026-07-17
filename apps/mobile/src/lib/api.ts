import { createClient, ApiError } from '@surveylink/api-client';
import { API_URL } from './config';
import { getToken } from './session';

export const api = createClient({
  baseUrl: API_URL,
  getAuthToken: () => getToken(),
});

export { ApiError };

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string | string[] } | undefined;
    const msg = body?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    if (err.status === 401) return 'Please sign in to continue.';
    if (err.status === 503) {
      return 'Auth provider is unavailable. For local testing, make sure AUTH_DEV_MODE=true on the API and restart it.';
    }
    return `Request failed (${err.status}).`;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
