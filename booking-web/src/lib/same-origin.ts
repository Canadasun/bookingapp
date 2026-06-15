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
  if (origin.replace(/\/$/, "") !== req.nextUrl.origin.replace(/\/$/, "")) {
    throw new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
  }
}
