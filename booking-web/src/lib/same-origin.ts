import type { NextRequest } from "next/server";

export function assertSameOrigin(req: NextRequest) {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
  }

  const origin = req.headers.get("origin");
  // No Origin header: Safari on iOS/macOS omits it on same-origin fetch POST
  // requests (longstanding WebKit bug). All session cookies are SameSite=Lax,
  // which already prevents a cross-origin attacker from sending them, so
  // allowing no-origin requests is safe.
  if (!origin) return;
  // Behind Railway's reverse proxy req.nextUrl.origin resolves to the internal
  // host, not the public domain. Use NEXT_PUBLIC_WEB_URL as the authoritative
  // expected origin and fall back to req.nextUrl.origin in dev where the env
  // var isn't set.
  const expected = (process.env.NEXT_PUBLIC_WEB_URL ?? req.nextUrl.origin).replace(/\/$/, "");
  if (origin.replace(/\/$/, "") !== expected) {
    throw new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
  }
}
