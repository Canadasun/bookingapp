import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import { assertSameOrigin } from "@/lib/same-origin";

const API = apiBase();

export async function POST(req: NextRequest) {
  const blocked = assertSameOrigin(req);
  if (blocked) return blocked;
  const token = req.cookies.get("booking_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const upstream = await fetch(`${API}/auth/seed-demo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await upstream.json().catch(() => ({})) as Record<string, unknown>;
  return NextResponse.json(data, { status: upstream.status });
}
