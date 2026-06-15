import type { NextRequest } from "next/server";

export function assertSameOrigin(req: NextRequest) {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
  }

  const origin = req.headers.get("origin");
  if (!origin) {
    if (req.headers.has("cookie")) {
      throw new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
    }
    return;
  }
  if (origin.replace(/\/$/, "") !== req.nextUrl.origin.replace(/\/$/, "")) {
    throw new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
  }
}
