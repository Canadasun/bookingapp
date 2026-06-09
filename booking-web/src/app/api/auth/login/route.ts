import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";

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
    return NextResponse.json({ message: errorMessage(err, upstream.statusText || "Login failed") }, { status: upstream.status });
  }

  const data = await readJson<{
    twoFactorRequired?: boolean;
    challengeId?: string;
    method?: string;
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
    maxAge: 60 * 60 * 24 * 7,
  });
  // Readable user profile cookie so client JS knows who is logged in
  res.cookies.set("booking_user", Buffer.from(JSON.stringify(data.user)).toString("base64"), {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
