import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";

const API = apiBase();

// Second factor: exchange the OTP from the login challenge for session cookies.
// Mirrors /api/auth/login's cookie handling exactly.
export async function POST(req: NextRequest) {
  const body = await req.json() as { challengeId: string; code: string; rememberDevice?: boolean };
  const upstream = await fetch(`${API}/auth/2fa/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-user-agent": req.headers.get("user-agent") ?? "",
      "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({})) as Record<string, unknown>;
    return NextResponse.json(err, { status: upstream.status });
  }

  const data = await upstream.json() as {
    accessToken: string;
    refreshToken: string;
    trustedDeviceToken?: string;
    user: { id: string; name: string; email: string; role: string; businessId: string | null; staffId: string | null; mustResetPassword: boolean; twoFactorEnabled?: boolean; twoFactorMethod?: string };
  };

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ user: data.user });
  // "Remember this device": persist the trusted-device token (30 days) so the
  // next sign-in on this device skips the 2FA prompt.
  if (data.trustedDeviceToken) {
    res.cookies.set("booking_td", data.trustedDeviceToken, {
      httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
  }
  res.cookies.set("booking_token", data.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 15,
  });
  res.cookies.set("booking_refresh", data.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  res.cookies.set("booking_user", Buffer.from(JSON.stringify(data.user)).toString("base64"), {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
