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
 * HMAC(appointmentId) with JWT_SECRET → stable per appointment, no DB needed.
 */
function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set — cannot sign manage tokens.');
  return s;
}

export function signAppointmentToken(appointmentId: string): string {
  return createHmac('sha256', secret()).update(appointmentId).digest('base64url');
}

export function verifyAppointmentToken(appointmentId: string, token?: string | null): boolean {
  if (!token) return false;
  const expected = signAppointmentToken(appointmentId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
