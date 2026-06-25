import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
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
const secure = () => process.env.NODE_ENV === "production";

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

export function encodeState(intent: "owner" | "client"): string {
  return `${randomBytes(16).toString("hex")}:${intent}`;
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
