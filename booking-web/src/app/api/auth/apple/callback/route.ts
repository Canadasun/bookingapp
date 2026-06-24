import { NextRequest, NextResponse } from "next/server";
import { apiBase } from "@/lib/server-api";
import {
  applySessionCookies,
  clearSSOStateCookie,
  roleHome,
  APP_URL,
  type SSOTokens,
} from "@/lib/sso-cookies";

// Apple sends a form_post to this URL after sign-in.
// The body contains: code, id_token, state, and optionally user (JSON, first auth only).
export async function POST(req: NextRequest) {
  const base = APP_URL();
  const errRedirect = (msg: string) => {
    const r = NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(msg)}`,
    );
    clearSSOStateCookie(r);
    return r;
  };

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errRedirect("Invalid Apple response");
  }

  const state = formData.get("state") as string | null;
  const identityToken = formData.get("id_token") as string | null;
  const userJson = formData.get("user") as string | null;

  if (!identityToken || !state) return errRedirect("Missing Apple identity token");

  const cookieState = req.cookies.get("pulse_sso_state")?.value;
  if (!cookieState || cookieState !== state) {
    return errRedirect("Invalid state — please try again");
  }

  let firstName: string | undefined;
  let lastName: string | undefined;
  let email: string | undefined;
  if (userJson) {
    try {
      const u = JSON.parse(userJson) as {
        name?: { firstName?: string; lastName?: string };
        email?: string;
      };
      firstName = u.name?.firstName ?? undefined;
      lastName = u.name?.lastName ?? undefined;
      email = u.email ?? undefined;
    } catch { /* malformed user JSON — proceed without name */ }
  }

  const API = apiBase();
  let upstream: Response | null = null;
  try {
    upstream = await fetch(`${API}/auth/apple/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identityToken, email, firstName, lastName, platform: "web" }),
    });
  } catch {
    return errRedirect("Could not reach the authentication server");
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({})) as Record<string, unknown>;
    const msg = typeof body.message === "string" ? body.message : "Apple sign-in failed";
    return errRedirect(msg);
  }

  const data = await upstream.json() as SSOTokens;
  const home = roleHome(data.user.role);
  const res = NextResponse.redirect(`${base}${home}`);
  clearSSOStateCookie(res);
  applySessionCookies(res, data);
  return res;
}
