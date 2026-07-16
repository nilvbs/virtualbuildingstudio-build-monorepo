import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Resolve the API base URL for the current device.
 * Phone builds derive the laptop IP from Metro so localhost is never used.
 */
export function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2
      ?.extra?.expoGo?.debuggerHost ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;

  const host = hostUri?.split(':')[0]?.trim();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:4000`;
  }

  if (Platform.OS === 'android' && !Constants.isDevice) {
    return 'http://10.0.2.2:4000';
  }

  return 'http://localhost:4000';
}

export const API_URL = resolveApiUrl();
