import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import { signCookieValue } from "@/lib/cookie-sign";
import { assertSameOrigin } from "@/lib/same-origin";
import { refreshMaxAge } from "@/lib/sso-cookies";

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

export async function POST(req: NextRequest) {
  assertSameOrigin(req);
  const input = await req.json() as { email: string; password: string };
  // A prior "remember this device" token lets a 2FA user skip the OTP here.
  const trustedDeviceToken = req.cookies.get("booking_td")?.value;
  const body = { ...input, email: input.email.trim().toLowerCase(), platform: 'web' as const, ...(trustedDeviceToken ? { trustedDeviceToken } : {}) };
  const upstream = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Forward the real client device/IP so the API can detect new-device logins.
      "x-client-user-agent": req.headers.get("user-agent") ?? "",
      "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const err = await readJson<Record<string, unknown>>(upstream);
    const code = typeof err?.code === "string" ? err.code : undefined;
    return NextResponse.json({ message: errorMessage(err, upstream.statusText || "Login failed"), ...(code ? { code } : {}) }, { status: upstream.status });
  }

  const data = await readJson<{
    twoFactorRequired?: boolean;
    challengeId?: string;
    method?: string;
    isAdmin?: boolean;
    accessToken: string;
    refreshToken: string;
    user: { id: string; name: string; email: string; role: string; businessId: string | null; staffId: string | null; mustResetPassword: boolean; emailVerified: boolean; twoFactorEnabled?: boolean; twoFactorMethod?: string };
  }>(upstream);

  if (!data) {
    return NextResponse.json({ message: "Login service returned an invalid response" }, { status: 502 });
  }

  if (data.twoFactorRequired) {
    return NextResponse.json({
      twoFactorRequired: true,
      challengeId: data.challengeId,
      method: data.method,
      isAdmin: data.isAdmin ?? false,
    });
  }
  if (!data.accessToken || !data.refreshToken || !data.user) {
    return NextResponse.json({ message: "Login service returned an incomplete session" }, { status: 502 });
  }

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ user: data.user });
  res.cookies.set("booking_token", data.accessToken, {
    // HttpOnly: the browser sends it automatically to the same-origin /proxy and
    // the API reads it from the cookie — client JS never touches it (XSS-safe).
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
    maxAge: refreshMaxAge(data.refreshToken),
  });
  // Readable hint cookie: carries routing fields (id, role, businessId, staffId,
  // permissions) but NOT email, mustResetPassword, emailVerified, or 2FA flags.
  // Those come from useCurrentUser() → /api/auth/me. TTL matches the access token
  // so it never outlasts the session.
  const { email: _e, mustResetPassword: _mr, emailVerified: _ev, twoFactorEnabled: _tfe, twoFactorMethod: _tfm, ...hint } = data.user as typeof data.user & Record<string, unknown>;
  void _e; void _mr; void _ev; void _tfe; void _tfm;
  res.cookies.set("booking_user", signCookieValue(Buffer.from(JSON.stringify(hint)).toString("base64")), {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
  return res;
}
