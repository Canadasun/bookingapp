import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";

const API = apiBase();

export async function GET(req: NextRequest) {
  const token = req.cookies.get("booking_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const upstream = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      await upstream.json().catch(() => ({ error: "Unauthenticated" })),
      { status: upstream.status },
    );
  }

  return NextResponse.json(await upstream.json());
}
