import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import {
  applySessionCookies,
  clearSSOStateCookie,
  roleHome,
  APP_URL,
  type SSOTokens,
} from "@/lib/sso-cookies";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const base = APP_URL();
  const errRedirect = (msg: string) => {
    const r = NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(msg)}`,
    );
    clearSSOStateCookie(r);
    return r;
  };

  if (error) return errRedirect("Google sign-in was cancelled");
  if (!code || !state) return errRedirect("Invalid OAuth response");

  const cookieState = req.cookies.get("pulse_sso_state")?.value;
  if (!cookieState || cookieState !== state) {
    return errRedirect("Invalid state — please try again");
  }

  const redirectUri = `${base}/api/auth/google/callback`;
  const API = apiBase();

  let upstream: Response | null = null;
  try {
    upstream = await fetch(`${API}/auth/google/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirectUri }),
    });
  } catch {
    return errRedirect("Could not reach the authentication server");
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({})) as Record<string, unknown>;
    const msg = typeof body.message === "string" ? body.message : "Google sign-in failed";
    return errRedirect(msg);
  }

  const data = await upstream.json() as SSOTokens;
  const home = roleHome(data.user.role);
  const res = NextResponse.redirect(`${base}${home}`);
  clearSSOStateCookie(res);
  applySessionCookies(res, data);
  return res;
}
