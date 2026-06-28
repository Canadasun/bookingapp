import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import { assertSameOrigin } from "@/lib/same-origin";
import { applySessionCookies, type SSOTokens } from "@/lib/sso-cookies";

const API = apiBase();

export async function POST(req: NextRequest) {
  const blocked = assertSameOrigin(req);
  if (blocked) return blocked;
  const token = req.cookies.get("booking_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { businessName?: string } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  let upstream: Response;
  try {
    upstream = await fetch(`${API}/auth/complete-owner-registration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ businessName: body.businessName ?? "" }),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach authentication server" }, { status: 503 });
  }

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({})) as Record<string, unknown>;
    return NextResponse.json(err, { status: upstream.status });
  }

  const data = await upstream.json() as SSOTokens;
  const res = NextResponse.json({ ok: true, user: data.user });
  applySessionCookies(res, data);
  return res;
}
