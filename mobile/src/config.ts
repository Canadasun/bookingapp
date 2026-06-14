// App-wide configuration: API base resolution + upload URL rewriting.

// Public marketing/legal site (where Terms & Privacy live).
export const WEB_URL = 'https://www.pulseappointments.com';

const PRODUCTION_DOMAIN = 'https://api.pulseappointments.com/api';
const isProd = !__DEV__;

// Auto-detect the dev machine's IP from Expo's host URI so the app works
// on physical devices without changing .env every time.
function resolveApiBase(): string {
  if (isProd) {
    // In production, always prefer the env var or the hardcoded domain.
    // Never attempt IP resolution or localhost fallbacks.
    return process.env.EXPO_PUBLIC_API_BASE ?? PRODUCTION_DOMAIN;
  }

  if (process.env.EXPO_PUBLIC_API_BASE && !process.env.EXPO_PUBLIC_API_BASE.includes('localhost')) {
    return process.env.EXPO_PUBLIC_API_BASE; // explicit non-localhost override wins
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default;
    const hostUri: string | undefined =
      Constants.expoConfig?.hostUri ??        // Expo Go SDK 46+
      Constants.manifest2?.extra?.expoClient?.hostUri ?? // EAS preview
      Constants.manifest?.debuggerHost;       // older SDK
    if (hostUri) {
      const host = hostUri.split(':')[0]; // strip port, keep IP
      return `http://${host}:3001/api`;
    }
  } catch { /* expo-constants not available — fall through */ }
  return process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3001/api';
}

export const API_BASE = resolveApiBase();

// Uploads are stored by the web as same-origin "/proxy/uploads/:id"; rewrite those
// (and bare "/uploads/:id") onto the API host so the native app can load them.
// Absolute http(s) URLs are returned untouched. Returns null when there's no image.
export function uploadUri(u?: string | null): string | null {
  if (!u) return null;
  if (/^https?:\/\//.test(u)) return u;
  const apiRoot = API_BASE.replace(/\/api\/?$/, '');
  const path = u.replace(/^\/proxy/, '');
  return `${apiRoot}${path.startsWith('/') ? '' : '/'}${path}`;
}

export const BIZ_ID = process.env.EXPO_PUBLIC_BUSINESS_ID ?? '';
