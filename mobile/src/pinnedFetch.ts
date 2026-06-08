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

const ALLOWED_HOSTS = new Set([
  'api.pulseappointments.com',
  'localhost',
  '127.0.0.1',
]);

// In dev, any IP/host is allowed (Expo tunnel / physical device LAN).
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
    // Relative URL — fine, it'll use the resolved API_BASE host
  }
}

export async function pinnedFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = input.startsWith('http') ? input : `${API_BASE}${input}`;
  assertAllowedHost(url);

  // Standard fetch — OS-level CA enforcement is handled by network-security-config.xml
  // (Android) and ATS (iOS). This wrapper provides the hook point for adding
  // react-native-ssl-pinning when the native module is available.
  return fetch(url, init);
}
