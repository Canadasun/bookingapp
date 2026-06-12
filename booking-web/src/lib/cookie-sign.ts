import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.COOKIE_SIGN_SECRET ?? "";

// Appends an HMAC-SHA256 signature to a cookie value.
// When COOKIE_SIGN_SECRET is not set, the value is returned unchanged
// so existing deployments aren't broken until the env var is provisioned.
export function signCookieValue(value: string): string {
  if (!SECRET) return value;
  const sig = createHmac("sha256", SECRET).update(value).digest("base64url");
  return `${value}.${sig}`;
}

export function verifyCookieValue(signed: string): string | null {
  if (!SECRET) return signed;
  const dot = signed.lastIndexOf(".");
  if (dot === -1) return null;
  const value = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const expected = createHmac("sha256", SECRET).update(value).digest("base64url");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig, "utf8");
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? value : null;
  } catch {
    return null;
  }
}
