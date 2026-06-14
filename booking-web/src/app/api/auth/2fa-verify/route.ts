import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import { signCookieValue } from "@/lib/cookie-sign";

const API = apiBase();

async function readJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function errorMessage(body: Record<string, unknown> | null, fallback: string) {
  const raw = body?.message;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const nested = (raw as Record<string, unknown>).message;
    if (typeof nested === "string") return nested;
  }
  return fallback;
}

function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const expected = process.env.NEXT_PUBLIC_WEB_URL ?? "";
  if (expected && origin !== expected) {
    throw new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
  }
}

// Second factor: exchange the OTP from the login challenge for session cookies.
// Mirrors /api/auth/login's cookie handling exactly.
export async function POST(req: NextRequest) {
  assertSameOrigin(req);
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
    const err = await readJson<Record<string, unknown>>(upstream);
    return NextResponse.json({ message: errorMessage(err, upstream.statusText || "Verification failed") }, { status: upstream.status });
  }

  const data = await readJson<{
    accessToken: string;
    refreshToken: string;
    trustedDeviceToken?: string;
    user: { id: string; name: string; email: string; role: string; businessId: string | null; staffId: string | null; mustResetPassword: boolean; twoFactorEnabled?: boolean; twoFactorMethod?: string };
  }>(upstream);

  if (!data) {
    return NextResponse.json({ message: "Verification service returned an invalid response" }, { status: 502 });
  }
  if (!data.accessToken || !data.refreshToken || !data.user) {
    return NextResponse.json({ message: "Verification service returned an incomplete session" }, { status: 502 });
  }

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ user: data.user });
  // "Remember this device": persist the trusted-device token (30 days) so the
  // next sign-in on this device skips the 2FA prompt.
  if (data.trustedDeviceToken) {
    res.cookies.set("booking_td", data.trustedDeviceToken, {
      httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
  }
  res.cookies.set("booking_token", data.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
  res.cookies.set("booking_refresh", data.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  const { email: _e, mustResetPassword: _mr, twoFactorEnabled: _tfe, twoFactorMethod: _tfm, ...hint } = data.user;
  void _e; void _mr; void _tfe; void _tfm;
  res.cookies.set("booking_user", signCookieValue(Buffer.from(JSON.stringify(hint)).toString("base64")), {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
  return res;
}
