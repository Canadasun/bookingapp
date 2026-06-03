import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";

const API = apiBase();

export async function POST(req: NextRequest) {
  const token = req.cookies.get("booking_token")?.value;

  if (token) {
    // Best-effort — invalidate refresh token server-side
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete("booking_token");
  res.cookies.delete("booking_refresh");
  res.cookies.delete("booking_user");
  return res;
}
