/**
 * Production DB transport hardening (Phase 1 security).
 * Requires SSL on Prisma connection URLs when NODE_ENV=production.
 */
export function assertProductionDatabaseSsl(): void {
  const nodeEnv = String(process.env.NODE_ENV ?? 'development').trim();
  if (nodeEnv !== 'production') return;

  for (const name of ['DATABASE_URL', 'DIRECT_DATABASE_URL'] as const) {
    const raw = process.env[name];
    if (!raw) continue;
    if (!connectionUsesSsl(raw)) {
      throw new Error(
        `${name} must include sslmode=require (or verify-ca / verify-full) in production`,
      );
    }
  }
}

export function connectionUsesSsl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('sslmode=require') ||
    lower.includes('sslmode=verify-ca') ||
    lower.includes('sslmode=verify-full') ||
    // Some managed providers use `ssl=true`
    /[?&]ssl=true(?:&|$)/.test(lower)
  );
}
