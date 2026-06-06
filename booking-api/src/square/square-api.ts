// Low-level Square REST + OAuth client. Raw fetch (no SDK) to keep deps/vulns low,
// mirroring the Google Calendar integration. All env-driven; sandbox by default.

const SQUARE_VERSION = '2025-01-23';

export function squareEnv(): 'sandbox' | 'production' {
  return process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
}

export function squareApiBase(): string {
  return squareEnv() === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

export interface SquareTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at?: string;
  merchant_id: string;
  token_type?: string;
}

// Authenticated Square API call with a given (merchant or platform) access token.
export async function squareFetch<T = any>(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${squareApiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const err = json?.errors?.[0];
    throw new Error(err?.detail || err?.code || `Square API error ${res.status}`);
  }
  return json as T;
}

// Build the OAuth authorize URL the business is redirected to in order to connect
// their Square account. Scopes cover client payments + saved cards.
export function squareAuthorizeUrl(state: string): string {
  const scopes = [
    'MERCHANT_PROFILE_READ',
    'PAYMENTS_WRITE',
    'PAYMENTS_READ',
    'CUSTOMERS_WRITE',
    'CUSTOMERS_READ',
  ].join(' ');
  const params = new URLSearchParams({
    client_id: process.env.SQUARE_APPLICATION_ID ?? '',
    scope: scopes, // URLSearchParams encodes spaces as '+', which Square expects
    session: 'false',
    state,
  });
  return `${squareApiBase()}/oauth2/authorize?${params.toString()}`;
}

async function oauthToken(extra: Record<string, unknown>): Promise<SquareTokenResponse> {
  const res = await fetch(`${squareApiBase()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Square-Version': SQUARE_VERSION },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APPLICATION_ID,
      client_secret: process.env.SQUARE_APPLICATION_SECRET,
      ...extra,
    }),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(json?.errors?.[0]?.detail || `Square OAuth error ${res.status}`);
  return json as SquareTokenResponse;
}

// Exchange an authorization code for tokens.
export function squareExchangeCode(code: string): Promise<SquareTokenResponse> {
  return oauthToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.SQUARE_OAUTH_REDIRECT_URL,
  });
}

// Mint a fresh access token from a stored refresh token (access tokens last ~30d).
export function squareRefresh(refreshToken: string): Promise<SquareTokenResponse> {
  return oauthToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

// Revoke a merchant's access token on disconnect (best-effort).
export async function squareRevoke(accessToken: string): Promise<void> {
  await fetch(`${squareApiBase()}/oauth2/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Square-Version': SQUARE_VERSION,
      Authorization: `Client ${process.env.SQUARE_APPLICATION_SECRET}`,
    },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APPLICATION_ID,
      access_token: accessToken,
    }),
  }).catch(() => {});
}
