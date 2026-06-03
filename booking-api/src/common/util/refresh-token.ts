import { createHash } from 'crypto';

// Refresh tokens are stored as a sha256 hash (not plaintext), so a DB leak can't
// be used to replay live sessions. Both the issuer and the refresh strategy hash
// the same way to compare.
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
