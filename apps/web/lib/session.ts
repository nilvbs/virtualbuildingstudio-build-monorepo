'use client';

import type { WorkspaceRole } from '@surveylink/types';

/**
 * Client-side session marker. Access / refresh tokens live only in httpOnly
 * cookies set by the API (never readable by JS). localStorage keeps just a
 * non-secret "signed in" flag and the chosen workspace for UI routing.
 */
const KEY = 'surveylink.session';

export interface StoredSession {
  /** Marketplace workspace chosen at login (client or surveyor). */
  activeRole?: WorkspaceRole;
  signedInAt: number;
}

export function getSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession> & { accessToken?: unknown };
    if ('accessToken' in parsed) {
      // Pre-cookie session: drop stored tokens and require a fresh sign-in.
      window.localStorage.removeItem(KEY);
      return null;
    }
    return { activeRole: parsed.activeRole, signedInAt: parsed.signedInAt ?? Date.now() };
  } catch {
    return null;
  }
}

/** Mark the browser as signed in after the API set the session cookies. */
export function setSession(session: { activeRole?: WorkspaceRole }): void {
  if (typeof window === 'undefined') return;
  const value: StoredSession = { activeRole: session.activeRole, signedInAt: Date.now() };
  window.localStorage.setItem(KEY, JSON.stringify(value));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}

export function getActiveRole(): WorkspaceRole | undefined {
  return getSession()?.activeRole;
}

export function setActiveRole(role: WorkspaceRole): void {
  const current = getSession();
  if (!current) return;
  window.localStorage.setItem(KEY, JSON.stringify({ ...current, activeRole: role }));
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}
