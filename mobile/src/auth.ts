// Auth store: in-memory token/refresh/user, persisted to the device keychain
// via SecureStore. A tiny listener set lets the root re-render on auth changes.
import * as SecureStore from 'expo-secure-store';
import { API_BASE, BIZ_ID } from './config';
import type { User } from './types';

let _token:   string|null = null;
let _refresh: string|null = null;
let _user:    User|null   = null;
export const listeners: Set<()=>void> = new Set();
const notify = () => listeners.forEach(fn => fn());
const AUTH_KEY = 'bookingapp.auth.v1';

export const setAuth = (token: string|null, user: User|null, refresh?: string|null) => {
  _token = token; _user = user;
  if (refresh !== undefined) _refresh = refresh;
  notify();
};
export const getAuth = () => ({ token: _token, user: _user, refresh: _refresh });

// The active business is the one the signed-in owner/staff belongs to. Each
// account is fully isolated — we never assume the baked EXPO_PUBLIC_BUSINESS_ID
// (kept only as a fallback for the unauthenticated/demo case).
export const bizId = (): string => getAuth().user?.businessId || BIZ_ID;

// Persist the current session to the device keychain (or clear it). Wrapped in
// try/catch because SecureStore is unavailable on web — there we stay in-memory.
export async function persistAuth() {
  try {
    if (_token && _refresh) {
      await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify({ token: _token, refresh: _refresh, user: _user }));
    } else {
      await SecureStore.deleteItemAsync(AUTH_KEY);
    }
  } catch { /* keychain unavailable — session remains in memory only */ }
}

// Load a previously persisted session on cold start. Returns true if a refresh
// token was found (so the caller can refresh for a fresh access token).
export async function loadPersistedAuth(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { token?:string; refresh?:string; user?:User };
    setAuth(parsed.token ?? null, parsed.user ?? null, parsed.refresh ?? null);
    return !!parsed.refresh;
  } catch { return false; }
}

// Exchange the stored refresh token (7d) for a fresh access token (15m).
// Called on cold start and on a 401 mid-session. Rotates + re-persists tokens.
export async function refreshSession(): Promise<boolean> {
  if (!_refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: _refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json() as { accessToken:string; refreshToken:string; user:User };
    setAuth(data.accessToken, data.user, data.refreshToken);
    await persistAuth();
    return true;
  } catch { return false; }
}
