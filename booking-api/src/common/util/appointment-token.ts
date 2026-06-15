import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Stateless "manage link" token for the unauthenticated client booking pages.
 *
 * The public booking endpoints are keyed by appointment id (a cuid), which is
 * NOT a secret — it travels in emails and URLs. To stop anyone who learns/guesses
 * an id from reading a client's details or cancelling/rescheduling their booking,
 * the manage link carries an HMAC of the id. Only someone who received the email
 * (or the owner, who can mint it) has a valid token.
 *
 * The signed expiry bounds the lifetime of a leaked link without requiring DB state.
 */
function secret(): string {
  // Prefer a dedicated secret so a compromise of appointment tokens does not
  // affect JWT session security. Falls back to JWT_SECRET for deployments that
  // have not yet provisioned the separate variable.
  const s = process.env.APPOINTMENT_TOKEN_SECRET ?? process.env.JWT_SECRET;
  if (!s) throw new Error('APPOINTMENT_TOKEN_SECRET (or JWT_SECRET) is not set — cannot sign manage tokens.');
  return s;
}

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

export function signAppointmentToken(appointmentId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = createHmac('sha256', secret())
    .update(`${appointmentId}.${exp}`)
    .digest('base64url');
  return `${exp}.${signature}`;
}

export function verifyAppointmentToken(appointmentId: string, token?: string | null): boolean {
  if (!token) return false;
  const [rawExp, signature, extra] = token.split('.');
  const exp = Number(rawExp);
  if (!rawExp || !signature || extra || !Number.isSafeInteger(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = createHmac('sha256', secret())
    .update(`${appointmentId}.${exp}`)
    .digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
