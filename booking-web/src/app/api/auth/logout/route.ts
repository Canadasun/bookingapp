import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";

const API = apiBase();

function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const expected = process.env.NEXT_PUBLIC_WEB_URL ?? "";
  if (expected && origin !== expected) {
    throw new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  assertSameOrigin(req);
  let token = req.cookies.get("booking_token")?.value;

  // If the short-lived access token has expired, exchange the refresh token
  // first so logout can still revoke this account's server-side sessions.
  const refreshToken = req.cookies.get("booking_refresh")?.value;
  if (!token && refreshToken) {
    const refresh = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
    if (refresh?.ok) {
      const data = await refresh.json().catch(() => null) as { accessToken?: string } | null;
      token = data?.accessToken;
    }
  }

  if (token) {
    // Best-effort: revoke access and refresh sessions server-side.
    const logout = await fetch(`${API}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);

    if (logout?.status === 401 && refreshToken) {
      const refresh = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => null);
      if (refresh?.ok) {
        const data = await refresh.json().catch(() => null) as { accessToken?: string } | null;
        if (data?.accessToken) {
          await fetch(`${API}/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${data.accessToken}` },
          }).catch(() => null);
        }
      }
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete("booking_token");
  res.cookies.delete("booking_refresh");
  res.cookies.delete("booking_user");
  // booking_td (trusted-device) is intentionally kept across logout so the
  // 30-day device trust survives sign-out/sign-in cycles.
  return res;
}
