/**
 * Phone normalization to E.164 (the format Twilio requires to send SMS).
 *
 * The product is North-America-first (the Twilio sender is a +1 number), so a
 * bare 10-digit number is treated as NANP (+1). Numbers already in international
 * `+<country><number>` form are validated and kept. Anything that can't be
 * resolved to a complete E.164 number returns null so the caller can reject it.
 */
export function normalizePhone(input?: string | null): string | null {
  if (input == null) return null;
  const raw = input.trim();
  if (!raw) return null;

  if (raw.startsWith('+')) {
    // International: keep only the leading + and the digits.
    const digits = raw.slice(1).replace(/\D/g, '');
    // E.164: up to 15 digits, country code can't start with 0.
    if (/^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
    return null;
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;                 // NANP without country code
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`; // NANP with leading 1
  return null; // too short/long to be a complete number
}

/** True when the input is a complete, normalizable phone number. */
export function isValidPhone(input?: string | null): boolean {
  return normalizePhone(input) !== null;
}
