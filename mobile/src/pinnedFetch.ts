// Hardened fetch wrapper for production API calls.
//
// Current protections:
//   • Android (release builds): system CAs only via network-security-config.xml
//     — user-installed proxy/MITM certificates are rejected by the OS.
//   • iOS: App Transport Security enforces system CAs by default.
//   • Hostname whitelist: rejects requests to unexpected origins in production.
//
import { API_BASE } from './config';
// @ts-ignore
import { fetch as sslFetch } from 'react-native-ssl-pinning';

// Keep these synchronized with network-security-config.xml. The leaf key is
// backed by the longer-lived Let's Encrypt intermediate key for rotation.
const API_PUBLIC_KEY_PINS = [
  'sha256/Y2szDQ38zdCBYaiOpHUXO4mySTA3HXYwVOPUQeg4izY=',
  'sha256/nWN7PSep5XDQdge5zK24CnCRXHr3KvzhKEGxsdqCX9E=',
];

const ALLOWED_HOSTS = new Set([
  'api.pulseappointments.com',
  'localhost',
  '127.0.0.1',
]);

const isDev = __DEV__;

function assertAllowedHost(url: string) {
  if (isDev) return;
  try {
    const { hostname } = new URL(url);
    if (!ALLOWED_HOSTS.has(hostname)) {
      throw new Error(`pinnedFetch: blocked request to unexpected host "${hostname}"`);
    }
    if (!url.startsWith('https://')) {
      throw new Error('pinnedFetch: production requests must use HTTPS');
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('pinnedFetch:')) throw e;
    throw new Error('pinnedFetch: invalid request URL');
  }
}

export async function pinnedFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = input.startsWith('http') ? input : `${API_BASE}${input}`;
  assertAllowedHost(url);

  if (isDev) {
    return fetch(url, init);
  }

  // Production fails closed: a missing native module, bad pin, or TLS error must
  // never downgrade to ordinary fetch.
  const response = await sslFetch(url, {
    method: ((init?.method ?? 'GET').toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE'),
    headers: (init?.headers as any) || {},
    body: init?.body == null ? undefined : init.body as any,
    pkPinning: true,
    sslPinning: { certs: API_PUBLIC_KEY_PINS },
    timeoutInterval: 30000,
  });

  const body = response.bodyString ?? '';
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    headers: new Headers((response.headers as Record<string, string>) ?? {}),
    json: async () => body ? JSON.parse(body) : null,
    text: async () => body,
  } as Response;
}
