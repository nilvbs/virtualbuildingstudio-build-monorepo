import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const STATE_TTL_SEC = 10 * 60;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('base64url');
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(`oauth-state.${body}`).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Signed, expiring OAuth `state`. Only the hash of the nonce is embedded; the
 * raw nonce stays with the browser (httpOnly cookie) or the mobile app, so a
 * state/code pair captured by an attacker cannot be completed elsewhere.
 */
export function createOAuthState<R extends string>(
  role: R,
  secret: string,
): { state: string; nonce: string } {
  const nonce = randomBytes(24).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ r: role, n: sha256(nonce), e: Math.floor(Date.now() / 1000) + STATE_TTL_SEC }),
    'utf8',
  ).toString('base64url');
  return { state: `${body}.${sign(body, secret)}`, nonce };
}

/** Returns the role when the state is authentic, unexpired, and bound to `nonce`. */
export function verifyOAuthState(
  state: string,
  nonce: string | undefined,
  secret: string,
): { role: string } | null {
  if (!nonce) return null;
  const dot = state.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  if (!safeEqual(sig, sign(body, secret))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      r?: string;
      n?: string;
      e?: number;
    };
    if (typeof parsed.e !== 'number' || parsed.e < Math.floor(Date.now() / 1000)) return null;
    if (typeof parsed.n !== 'string' || !safeEqual(parsed.n, sha256(nonce))) return null;
    return { role: String(parsed.r ?? '') };
  } catch {
    return null;
  }
}

export const OAUTH_STATE_TTL_SEC = STATE_TTL_SEC;
