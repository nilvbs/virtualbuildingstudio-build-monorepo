import type { Request } from 'express';

export const ACCESS_COOKIE = 'bld_at';
export const REFRESH_COOKIE = 'bld_rt';
export const OAUTH_NONCE_COOKIE = 'bld_oauth';

/**
 * Web clients send `X-BLD-Session: cookie`. Cookies are only read when this
 * header is present: a custom header forces a CORS preflight, so cross-site
 * pages cannot ride the httpOnly cookies (CSRF defense on top of SameSite).
 */
export const SESSION_TRANSPORT_HEADER = 'x-bld-session';

export function isCookieTransport(req: Pick<Request, 'headers'>): boolean {
  const raw = req.headers[SESSION_TRANSPORT_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value ?? '').trim().toLowerCase() === 'cookie';
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue;
    const rawValue = part.slice(eq + 1).trim();
    try {
      out[name] = decodeURIComponent(rawValue);
    } catch {
      out[name] = rawValue;
    }
  }
  return out;
}

export function readCookie(req: Pick<Request, 'headers'>, name: string): string | undefined {
  const value = parseCookieHeader(req.headers.cookie)[name];
  return value ? value : undefined;
}
