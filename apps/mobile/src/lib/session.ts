import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthSession, WorkspaceRole } from '@surveylink/types';

const KEY = 'surveylink.session';

export interface StoredSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  activeRole?: WorkspaceRole;
}

/** Keychain (iOS) / Keystore (Android). Expo web has no secure store. */
const secure = Platform.OS !== 'web';

async function readRaw(): Promise<string | null> {
  if (!secure) return AsyncStorage.getItem(KEY);
  const value = await SecureStore.getItemAsync(KEY);
  if (value) return value;
  // One-time move of a pre-SecureStore session out of plain AsyncStorage.
  const legacy = await AsyncStorage.getItem(KEY);
  if (legacy) {
    await SecureStore.setItemAsync(KEY, legacy);
    await AsyncStorage.removeItem(KEY);
  }
  return legacy;
}

export async function getSession(): Promise<StoredSession | null> {
  const raw = await readRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function setSession(session: StoredSession): Promise<void> {
  const raw = JSON.stringify(session);
  if (secure) {
    await SecureStore.setItemAsync(KEY, raw);
  } else {
    await AsyncStorage.setItem(KEY, raw);
  }
}

export async function clearSession(): Promise<void> {
  if (secure) await SecureStore.deleteItemAsync(KEY);
  await AsyncStorage.removeItem(KEY);
}

/** Persist the rotated tokens returned by `/auth/refresh`, keeping the workspace. */
export async function storeRefreshedSession(next: AuthSession): Promise<void> {
  const current = await getSession();
  await setSession({
    accessToken: next.accessToken,
    refreshToken: next.refreshToken ?? current?.refreshToken,
    expiresAt: Date.now() + next.expiresIn * 1000,
    activeRole: current?.activeRole ?? next.activeRole,
  });
}

export async function getToken(): Promise<string | undefined> {
  return (await getSession())?.accessToken;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await getSession())?.refreshToken;
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
