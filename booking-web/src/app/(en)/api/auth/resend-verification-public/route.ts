import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import { assertSameOrigin } from "@/lib/same-origin";

const API = apiBase();

export async function POST(req: NextRequest) {
  const blocked = assertSameOrigin(req);
  if (blocked) return blocked;
  const body = await req.json().catch(() => ({})) as { email?: string };
  if (!body.email) return NextResponse.json({ error: "Email required" }, { status: 400 });
  const upstream = await fetch(`${API}/auth/resend-verification-public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email }),
  }).catch(() => null);
  if (!upstream?.ok) return NextResponse.json({ error: "Failed to resend" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
