'use client';

import type { WorkspaceRole } from '@surveylink/types';

/**
 * Minimal client-side session store. Phase 1 keeps the Auth0 token bundle in
 * localStorage so the SPA can call protected endpoints. (A hardened Phase 2
 * setup would use httpOnly cookies / silent refresh; this is intentionally
 * simple and swappable.)
 */
const KEY = 'surveylink.session';

export interface StoredSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  /** Marketplace workspace chosen at login (client or surveyor). */
  activeRole?: WorkspaceRole;
}

export function getSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function setSession(session: StoredSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}

export function getToken(): string | undefined {
  return getSession()?.accessToken;
}

export function getActiveRole(): WorkspaceRole | undefined {
  return getSession()?.activeRole;
}

export function setActiveRole(role: WorkspaceRole): void {
  const current = getSession();
  if (!current) return;
  setSession({ ...current, activeRole: role });
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}
