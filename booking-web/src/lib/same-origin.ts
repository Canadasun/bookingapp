import { NextRequest } from "next/server";

export function assertSameOrigin(req: NextRequest) {
  const expected = process.env.NEXT_PUBLIC_WEB_URL?.replace(/\/$/, "");
  if (!expected && process.env.NODE_ENV === "production") {
    throw new Response(JSON.stringify({ message: "Server misconfiguration" }), { status: 500 });
  }

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
  if (origin.replace(/\/$/, "") !== (expected ?? req.nextUrl.origin)) {
    throw new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
  }
}
