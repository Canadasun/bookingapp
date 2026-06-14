import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import { signCookieValue } from "@/lib/cookie-sign";

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
  const body = await req.json() as { enabled: boolean; method?: "EMAIL" | "SMS" };
  const token = req.cookies.get("booking_token")?.value;
  const callSetTwoFactor = (accessToken?: string) => fetch(`${API}/auth/2fa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  let upstream = await callSetTwoFactor(token);
  let refreshed: { accessToken: string; refreshToken: string } | null = null;
  if (upstream.status === 401) {
    const refreshToken = req.cookies.get("booking_refresh")?.value;
    if (refreshToken) {
      const refresh = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (refresh.ok) {
        refreshed = await refresh.json() as { accessToken: string; refreshToken: string };
        upstream = await callSetTwoFactor(refreshed.accessToken);
      }
    }
  }

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({})) as Record<string, unknown>;
    return NextResponse.json(err, { status: upstream.status });
  }

  const data = await upstream.json() as {
    ok: boolean;
    twoFactorEnabled: boolean;
    recoveryCodes?: string[];
    user?: { id: string; name: string; email: string; role: string; businessId: string | null; staffId: string | null; mustResetPassword: boolean; twoFactorEnabled?: boolean; twoFactorMethod?: string };
  };

  const secure = process.env.NODE_ENV === "production";
  const res = NextResponse.json(data);
  if (refreshed) {
    res.cookies.set("booking_token", refreshed.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });
    res.cookies.set("booking_refresh", refreshed.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  if (data.user) {
    const hint = { name: data.user.name, role: data.user.role };
    res.cookies.set("booking_user", signCookieValue(Buffer.from(JSON.stringify(hint)).toString("base64")), {
      httpOnly: false,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });
  }
  if (!body.enabled) {
    res.cookies.set("booking_td", "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}
