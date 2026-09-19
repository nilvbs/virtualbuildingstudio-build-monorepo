/**
 * Production DB transport hardening (Phase 1 security).
 * Requires SSL and forbids local Docker/host Postgres when NODE_ENV=production.
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
    if (connectionLooksLikeLocalDocker(raw)) {
      throw new Error(
        `${name} must not point at local Docker/host Postgres in production (use Aurora with sslmode=require)`,
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

/** Docker compose service `db`, localhost, or private loopback — not Aurora. */
export function connectionLooksLikeLocalDocker(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'db' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === 'bld-db' ||
      host.endsWith('.local')
    );
  } catch {
    const lower = url.toLowerCase();
    return (
      lower.includes('@db:') ||
      lower.includes('@localhost') ||
      lower.includes('@127.0.0.1') ||
      lower.includes('@bld-db')
    );
  }
}
