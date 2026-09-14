import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 } as const;

/**
 * Hash a password for local verification when Auth0 Resource Owner Password
 * Grant is unavailable. Format: `scrypt$<saltB64>$<hashB64>`.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT_OPTS);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const salt = Buffer.from(parts[1], 'base64url');
  const expected = Buffer.from(parts[2], 'base64url');
  if (!salt.length || expected.length !== KEYLEN) return false;
  try {
    const actual = scryptSync(password, salt, KEYLEN, SCRYPT_OPTS);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
