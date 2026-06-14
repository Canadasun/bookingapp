import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import { signCookieValue } from "@/lib/cookie-sign";

const API = apiBase();

type RefreshData = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string; role: string; businessId: string | null; staffId: string | null; mustResetPassword: boolean; twoFactorEnabled?: boolean; twoFactorMethod?: string };
};

// Deduplicates concurrent refresh calls that carry the same token (e.g. two
// tabs both hitting /api/auth/me at the same instant with an expired access
// token). Without this, both tabs race to POST /auth/refresh; the first
// rotates the session row and the second's token is now stale — it gets a 401,
// clears cookies, and the user is logged out in that tab.
const pendingRefreshes = new Map<string, Promise<RefreshData | null>>();

async function silentRefresh(refreshToken: string): Promise<RefreshData | null> {
  const key = createHash("sha256").update(refreshToken).digest("hex");
  const pending = pendingRefreshes.get(key);
  if (pending) return pending;
  const promise = fetch(`${API}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then((r) => (r.ok ? (r.json() as Promise<RefreshData>) : null))
    .catch(() => null)
    .finally(() => pendingRefreshes.delete(key));
  pendingRefreshes.set(key, promise);
  return promise;
}

function applySessionCookies(res: NextResponse, data: RefreshData) {
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set("booking_token", data.accessToken, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 15,
  });
  res.cookies.set("booking_refresh", data.refreshToken, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  const { email: _e, mustResetPassword: _mr, twoFactorEnabled: _tfe, twoFactorMethod: _tfm, ...hint } = data.user;
  void _e; void _mr; void _tfe; void _tfm;
  res.cookies.set("booking_user", signCookieValue(Buffer.from(JSON.stringify(hint)).toString("base64")), {
    httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: 60 * 15,
  });
}

function clearSessionCookies(res: NextResponse) {
  res.cookies.delete("booking_token");
  res.cookies.delete("booking_refresh");
  res.cookies.delete("booking_user");
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("booking_token")?.value;
  const refreshToken = req.cookies.get("booking_refresh")?.value;

  // No access token — attempt silent refresh before giving up
  if (!token) {
    if (!refreshToken) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    const data = await silentRefresh(refreshToken);
    if (!data) {
      const res = NextResponse.json({ error: "Session expired" }, { status: 401 });
      clearSessionCookies(res);
      return res;
    }
    const res = NextResponse.json(data.user);
    applySessionCookies(res, data);
    return res;
  }

  const upstream = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Access token expired mid-session — silently swap it before the client notices
  if (upstream.status === 401 && refreshToken) {
    const data = await silentRefresh(refreshToken);
    if (!data) {
      const res = NextResponse.json({ error: "Session expired" }, { status: 401 });
      clearSessionCookies(res);
      return res;
    }
    const res = NextResponse.json(data.user);
    applySessionCookies(res, data);
    return res;
  }

  if (!upstream.ok) {
    return NextResponse.json(
      await upstream.json().catch(() => ({ error: "Unauthenticated" })),
      { status: upstream.status },
    );
  }

  return NextResponse.json(await upstream.json());
}
