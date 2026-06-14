// Authenticated fetch wrapper with transparent token-refresh-on-401, plus
// best-effort Expo push-token registration.
import { Platform } from 'react-native';
import { API_BASE } from './config';
import { getAuth, refreshSession } from './auth';
import { pinnedFetch } from './pinnedFetch';

export async function api<T>(path: string, init?: RequestInit, _retried = false): Promise<T> {
  const { token } = getAuth();
  const isFormData = init?.body instanceof FormData;
  const res = await pinnedFetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  // Access token expired mid-session → refresh once and retry transparently.
  if (res.status === 401 && !_retried && getAuth().refresh) {
    if (await refreshSession()) return api<T>(path, init, true);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string,unknown>;
    const nested = body.message && typeof body.message === 'object'
      ? (body.message as Record<string, unknown>).message
      : undefined;
    throw new Error(typeof body.message === 'string' ? body.message : typeof nested === 'string' ? nested : `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function registerPushNotifications() {
  const { token, user } = getAuth();
  if (!token || !user) return;
  try {
    // Optional at runtime so local type-checks do not require the native module
    // before dependencies are installed. EAS installs expo-notifications from package.json.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('client-messages', {
        name: 'Urgent client messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 150, 250],
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const finalStatus = current.status === 'granted'
      ? current.status
      : (await Notifications.requestPermissionsAsync()).status;
    if (finalStatus !== 'granted') return;
    const Constants = require('expo-constants').default;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? 'a30e642e-d737-4642-9e9e-e832d7676cb5';
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = result?.data;
    if (!pushToken) return;
    await api('/users/me/device-token', {
      method:'POST',
      body: JSON.stringify({ token: pushToken, platform: Platform.OS.toUpperCase() }),
    }).catch(() => {});
  } catch {
    // Push is best-effort; never block login or app launch.
  }
}
