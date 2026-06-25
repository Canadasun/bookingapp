import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { signCookieValue } from "./cookie-sign";

export type SSOUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  businessId: string | null;
  staffId: string | null;
  mustResetPassword: boolean;
  emailVerified: boolean;
  twoFactorEnabled?: boolean;
  twoFactorMethod?: string;
};

export type SSOTokens = {
  accessToken: string;
  refreshToken: string;
  user: SSOUser;
};

const SSO_STATE_COOKIE = "pulse_sso_state";
const SSO_NONCE_COOKIE = "pulse_sso_nonce";
const SSO_PKCE_COOKIE  = "pulse_pkce_verifier";
const secure = () => process.env.NODE_ENV === "production";

export function encodeState(intent: "owner" | "client"): string {
  return `${randomBytes(16).toString("hex")}:${intent}`;
}

// Apple nonce helpers — nonce is hashed before sending to Apple;
// the raw value is kept in a short-lived HttpOnly cookie for callback verification.
export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}
export function hashNonce(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
export function setSSONonceCookie(res: NextResponse, raw: string) {
  res.cookies.set(SSO_NONCE_COOKIE, raw, {
    httpOnly: true, secure: secure(), sameSite: "lax", maxAge: 600, path: "/",
  });
}
export function clearSSONonceCookie(res: NextResponse) {
  res.cookies.set(SSO_NONCE_COOKIE, "", {
    httpOnly: true, secure: secure(), sameSite: "lax", maxAge: 0, path: "/",
  });
}

// Google PKCE helpers — code_verifier stored in cookie, challenge sent to Google.
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}
export function computeCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
export function setPKCECookie(res: NextResponse, verifier: string) {
  res.cookies.set(SSO_PKCE_COOKIE, verifier, {
    httpOnly: true, secure: secure(), sameSite: "lax", maxAge: 600, path: "/",
  });
}
export function clearPKCECookie(res: NextResponse) {
  res.cookies.set(SSO_PKCE_COOKIE, "", {
    httpOnly: true, secure: secure(), sameSite: "lax", maxAge: 0, path: "/",
  });
}

export function parseStateIntent(state: string): "owner" | "client" {
  return state.split(":")[1] === "owner" ? "owner" : "client";
}

export function setSSOStateCookie(res: NextResponse, state: string) {
  res.cookies.set(SSO_STATE_COOKIE, state, {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
}

export function clearSSOStateCookie(res: NextResponse) {
  res.cookies.set(SSO_STATE_COOKIE, "", {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export function applySessionCookies(res: NextResponse, data: SSOTokens) {
  const sec = secure();
  res.cookies.set("booking_token", data.accessToken, {
    httpOnly: true, secure: sec, sameSite: "lax", path: "/", maxAge: 60 * 15,
  });
  res.cookies.set("booking_refresh", data.refreshToken, {
    httpOnly: true, secure: sec, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  const { email: _e, mustResetPassword: _mr, emailVerified: _ev,
    twoFactorEnabled: _tfe, twoFactorMethod: _tfm, ...hint } =
    data.user as SSOUser & Record<string, unknown>;
  void _e; void _mr; void _ev; void _tfe; void _tfm;
  res.cookies.set("booking_user", signCookieValue(
    Buffer.from(JSON.stringify(hint)).toString("base64"),
  ), { httpOnly: false, secure: sec, sameSite: "lax", path: "/", maxAge: 60 * 15 });
}

export function roleHome(role: string): string {
  if (role === "ADMIN") return "/admin";
  if (role === "CLIENT") return "/my/dashboard";
  return "/dashboard";
}

export const APP_URL = () =>
  (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.pulseappointments.com").replace(/\/$/, "");
