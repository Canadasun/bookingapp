import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import {
  applySessionCookies,
  clearSSOStateCookie,
  clearPKCECookie,
  parseStateIntent,
  parseStateLocale,
  persistSSOLocale,
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
  const makeErrRedirect = (page: string) => (msg: string) => {
    const r = NextResponse.redirect(`${base}${page}?error=${encodeURIComponent(msg)}`);
    clearSSOStateCookie(r);
    return r;
  };
  const defaultErr = makeErrRedirect("/login");

  if (error) return defaultErr("Google sign-in was cancelled");
  if (!code || !state) return defaultErr("Invalid OAuth response");

  const cookieState = req.cookies.get("pulse_sso_state")?.value;
  if (!cookieState || cookieState !== state) {
    return defaultErr("Invalid state — please try again");
  }

  const intent = parseStateIntent(cookieState);
  const locale = parseStateLocale(cookieState);
  const errRedirect = makeErrRedirect(intent === "owner" ? "/register" : intent === "register" ? "/my/register" : "/login");

  const codeVerifier = req.cookies.get("pulse_pkce_verifier")?.value;
  if (!codeVerifier) return errRedirect("Sign-in session expired — please try again");

  const redirectUri = `${base}/api/auth/google/callback`;
  const API = apiBase();

  let upstream: Response | null = null;
  try {
    upstream = await fetch(`${API}/auth/google/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirectUri, codeVerifier, allowCreate: intent === "owner" || intent === "register" }),
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
  await persistSSOLocale(API, data.accessToken, locale);
  let destination: string;
  if (intent === "owner" && !(data.user.role === "OWNER" && data.user.businessId)) {
    destination = "/register/complete";
  } else {
    destination = roleHome(data.user.role);
  }
  // "register" intent: roleHome already sends CLIENT → /my/dashboard
  const res = NextResponse.redirect(`${base}${destination}`);
  clearSSOStateCookie(res);
  clearPKCECookie(res);
  applySessionCookies(res, data);
  return res;
}
