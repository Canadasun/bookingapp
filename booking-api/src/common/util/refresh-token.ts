import { createHash } from 'crypto';

// Refresh tokens are stored as a sha256 hash (not plaintext), so a DB leak can't
// be used to replay live sessions. Both the issuer and the refresh strategy hash
// the same way to compare.
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// How long a stored refresh SESSION stays valid, derived from the same
// JWT_REFRESH_EXPIRES_IN that bounds the token itself (default 7d). Supports
// "<n>d|h|m|s" (and a bare number = seconds); falls back to 7 days.
export function refreshTokenTtlMs(): number {
  const raw = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d').trim();
  const m = /^(\d+)\s*([smhd])?$/.exec(raw);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const mult = m[2] === 'd' ? 86_400_000 : m[2] === 'h' ? 3_600_000 : m[2] === 'm' ? 60_000 : 1_000;
  return n * mult;
}
