import { cookies } from "next/headers";
import { verifyCookieValue } from "@/lib/cookie-sign";

// The landing page (English at /, French at /fr) is the public marketing page.
// A signed-in user shouldn't see it — they get sent to where they belong. This
// resolves that destination from the session cookie, or null for anonymous
// visitors. Shared by both locale roots so the redirect rules can't drift.
export async function landingRedirectTarget(): Promise<string | null> {
  const jar = await cookies();
  const authed = !!(
    jar.get("booking_token")?.value ||
    jar.get("booking_refresh")?.value ||
    jar.get("booking_user")?.value
  );
  const raw = jar.get("booking_user")?.value;
  let role: string | undefined;
  if (raw) {
    for (const encoded of [raw, decodeURIComponent(raw)]) {
      const verified = verifyCookieValue(encoded);
      if (!verified) continue;
      try {
        role = JSON.parse(Buffer.from(verified, "base64").toString("utf8"))?.role;
        break;
      } catch {
        /* try next encoding */
      }
    }
  }
  if (role === "ADMIN") return "/admin";
  if (role === "CLIENT") return "/my/dashboard";
  if ((role && role !== "CLIENT") || (authed && !role)) return "/dashboard";
  return null;
}
