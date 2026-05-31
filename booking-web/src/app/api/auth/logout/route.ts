import { NextRequest, NextResponse } from "next/server";

const API = (process.env.API_INTERNAL_URL ?? "http://localhost:3001") + "/api";

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
