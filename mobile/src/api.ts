// Authenticated fetch wrapper with transparent token-refresh-on-401, plus
// best-effort Expo push-token registration.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_BASE } from './config';
import { getAuth, refreshSession } from './auth';
import { pinnedFetch } from './pinnedFetch';

export async function api<T>(path: string, init?: RequestInit, _retried = false): Promise<T> {
  const { token } = getAuth();
  const isFormData = init?.body instanceof FormData;
  const method = (init?.method ?? 'GET').toUpperCase();
  const canRetryTransport = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

  const performFetch = async (retryCount = 0): Promise<Response> => {
    try {
      const res = await pinnedFetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers ?? {}),
        },
      });
      return res;
    } catch (e) {
      if (canRetryTransport && retryCount < 2) {
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return performFetch(retryCount + 1);
      }
      throw e;
    }
  };

  const res = await performFetch();

  // Access token expired mid-session → refresh once and retry transparently.
  if (res.status === 401 && !_retried && getAuth().refresh) {
    if (await refreshSession()) return api<T>(path, init, true);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string,unknown>;
    const nested = body.message && typeof body.message === 'object'
      ? (body.message as Record<string, unknown>).message
      : undefined;
    const msg = typeof body.message === 'string' ? body.message : typeof nested === 'string' ? nested : `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status: number };
    err.status = res.status;
    throw err;
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
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
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
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
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
    const registered = await api<{ id: string }>('/users/me/device-token', {
      method:'POST',
      body: JSON.stringify({ token: pushToken, platform: Platform.OS.toUpperCase() }),
    });
    if (Platform.OS === 'ios') {
      // APNs notification previews cannot be forcibly redacted by app code. Keep
      // this device disabled until the server sends generic, non-PII push text.
      await api('/users/me/device-token', {
        method: 'PATCH',
        body: JSON.stringify({ id: registered.id, enabled: false }),
      });
      await SecureStore.deleteItemAsync('bookingapp.device-token-id.v1');
      return;
    }
    await SecureStore.setItemAsync('bookingapp.device-token-id.v1', registered.id);
  } catch {
    // Push is best-effort; never block login or app launch.
  }
}

export async function unregisterPushNotifications() {
  const authToken = getAuth().token;
  try {
    const id = await SecureStore.getItemAsync('bookingapp.device-token-id.v1');
    if (id) {
      await api('/users/me/device-token', {
        method: 'PATCH',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        body: JSON.stringify({ id, enabled: false }),
      });
    }
    await SecureStore.deleteItemAsync('bookingapp.device-token-id.v1');
  } catch {
    // Logout still clears local credentials if remote revocation is unavailable.
  }
}
