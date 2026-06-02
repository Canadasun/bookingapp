import { NextRequest, NextResponse } from "next/server";

const API = (process.env.API_INTERNAL_URL ?? "http://localhost:3001") + "/api";

export async function POST(req: NextRequest) {
  const body = await req.json() as { email: string; password: string };
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
    const err = await upstream.json().catch(() => ({})) as Record<string, unknown>;
    return NextResponse.json(err, { status: upstream.status });
  }

  const data = await upstream.json() as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; name: string; email: string; role: string; businessId: string | null; staffId: string | null; mustResetPassword: boolean };
  };

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
