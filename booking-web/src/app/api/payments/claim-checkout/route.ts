import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import { assertSameOrigin } from "@/lib/same-origin";

const API = apiBase();

// Attach the subscription a visitor just paid for (via a Stripe Payment Link)
// to the business they registered moments ago. Reads the auth cookie set by
// registration and forwards it as a Bearer token to the API.
export async function POST(req: NextRequest) {
  const blocked = assertSameOrigin(req);
  if (blocked) return blocked;
  const token = req.cookies.get("booking_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { sessionId?: string } = {};
  try { body = await req.json(); } catch { /* validated upstream */ }

  let upstream: Response;
  try {
    upstream = await fetch(`${API}/payments/claim-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId: body.sessionId ?? "" }),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the billing server" }, { status: 503 });
  }

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
