import { NextResponse, type NextRequest } from "next/server";

// Returns a 403 response when the request is cross-origin, or `null` when it is
// allowed. Callers must do `const blocked = assertSameOrigin(req); if (blocked)
// return blocked;`.
//
// We RETURN the response rather than `throw` one: Next.js App Router route
// handlers do not treat a thrown `Response` as the route's response — it
// surfaces as an unhandled error (HTTP 500) and a noisy `[object Response]`
// entry in Sentry instead of the intended clean 403.
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const origin = req.headers.get("origin");
  // No Origin header: Safari on iOS/macOS omits it on same-origin fetch POST
  // requests (longstanding WebKit bug). All session cookies are SameSite=Lax,
  // which already prevents a cross-origin attacker from sending them, so
  // allowing no-origin requests is safe.
  if (!origin) return null;
  // Behind Railway's reverse proxy req.nextUrl.origin resolves to the internal
  // host, not the public domain. Use NEXT_PUBLIC_WEB_URL as the authoritative
  // expected origin and fall back to req.nextUrl.origin in dev where the env
  // var isn't set.
  const expected = (process.env.NEXT_PUBLIC_WEB_URL ?? req.nextUrl.origin).replace(/\/$/, "");
  if (origin.replace(/\/$/, "") !== expected) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  return null;
}
