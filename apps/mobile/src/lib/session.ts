import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkspaceRole } from '@surveylink/types';

const KEY = 'surveylink.session';

export interface StoredSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  activeRole?: WorkspaceRole;
}

export async function getSession(): Promise<StoredSession | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function setSession(session: StoredSession): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function getToken(): Promise<string | undefined> {
  return (await getSession())?.accessToken;
}

export async function getActiveRole(): Promise<WorkspaceRole | undefined> {
  return (await getSession())?.activeRole;
}

export async function setActiveRole(role: WorkspaceRole): Promise<void> {
  const current = await getSession();
  if (!current) return;
  await setSession({ ...current, activeRole: role });
}

export async function isAuthenticated(): Promise<boolean> {
  return Boolean(await getToken());
}
