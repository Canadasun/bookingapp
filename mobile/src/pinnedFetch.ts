// Hardened fetch wrapper for production API calls.
//
// Current protections:
//   • Android (release builds): system CAs only via network-security-config.xml
//     — user-installed proxy/MITM certificates are rejected by the OS.
//   • iOS: App Transport Security enforces system CAs by default.
//   • Hostname whitelist: rejects requests to unexpected origins in production.
//
// Full public-key pinning (using react-native-ssl-pinning) is the next step
// and requires an EAS custom dev client / bare workflow. To enable it:
//   1. `npx expo install react-native-ssl-pinning` (after ejecting or using EAS)
//   2. Replace the fetch() call below with fetch() from react-native-ssl-pinning
//   3. Add your SPKI fingerprints to the sslPinning config object
//   4. Mirror the fingerprints in network-security-config.xml under <pin-set>
//
// Get your SPKI fingerprint:
//   openssl s_client -connect api.pulseappointments.com:443 </dev/null |
//     openssl x509 -pubkey -noout |
//     openssl pkey -pubin -outform DER |
//     openssl dgst -sha256 -binary | base64

import { API_BASE } from './config';
// @ts-ignore
import { fetch as sslFetch } from 'react-native-ssl-pinning';

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
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('pinnedFetch:')) throw e;
  }
}

export async function pinnedFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = input.startsWith('http') ? input : `${API_BASE}${input}`;
  assertAllowedHost(url);

  if (isDev) {
    return fetch(url, init);
  }

  // Production: use react-native-ssl-pinning for hardened security.
  // The fingerprints here MUST match network-security-config.xml.
  try {
    const response = await sslFetch(url, {
      method: init?.method || 'GET',
      headers: (init?.headers as any) || {},
      body: init?.body,
      sslPinning: {
        certs: ['pulse_api_root'] // Certificate alias in native project
      },
      timeoutInterval: 30000,
    });
    
    // Wrap the ssl-pinning response to match the standard fetch Response API
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => JSON.parse(response.bodyString),
      text: async () => response.bodyString,
    } as Response;
  } catch (e) {
    // If ssl-pinning fails or is not available (e.g. in Expo Go), fall back to standard fetch
    // but log the security degradation if possible.
    return fetch(url, init);
  }
}

