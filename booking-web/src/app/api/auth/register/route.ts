import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import { signCookieValue } from "@/lib/cookie-sign";
import { assertSameOrigin } from "@/lib/same-origin";
import { refreshMaxAge } from "@/lib/sso-cookies";

const API = apiBase();

type RegisterData = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string; name: string; email: string; role: string;
    businessId: string | null; staffId: string | null;
    mustResetPassword: boolean; emailVerified: boolean;
    twoFactorEnabled?: boolean; twoFactorMethod?: string;
  };
};

export async function POST(req: NextRequest) {
  assertSameOrigin(req);
  const body = await req.json() as Record<string, unknown>;
  const upstream = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "",
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({})) as Record<string, unknown>;
    return NextResponse.json(err, { status: upstream.status });
  }

  const data = await upstream.json() as RegisterData;
  if (!data?.accessToken || !data?.refreshToken || !data?.user) {
    return NextResponse.json({ message: "Registration service returned an incomplete session" }, { status: 502 });
  }

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ user: data.user });
  res.cookies.set("booking_token", data.accessToken, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 15,
  });
  res.cookies.set("booking_refresh", data.refreshToken, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: refreshMaxAge(data.refreshToken),
  });
  const { email: _e, mustResetPassword: _mr, emailVerified: _ev, twoFactorEnabled: _tfe, twoFactorMethod: _tfm, ...hint } =
    data.user as typeof data.user & Record<string, unknown>;
  void _e; void _mr; void _ev; void _tfe; void _tfm;
  res.cookies.set("booking_user", signCookieValue(Buffer.from(JSON.stringify(hint)).toString("base64")), {
    httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: 60 * 15,
  });
  return res;
}
