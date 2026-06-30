import { NextRequest, NextResponse } from "next/server";
import {
  encodeState, setSSOStateCookie,
  generateCodeVerifier, computeCodeChallenge, setPKCECookie,
  APP_URL, type SSOIntent,
} from "@/lib/sso-cookies";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 503 });
  }

  const raw = req.nextUrl.searchParams.get("intent");
  const intent: SSOIntent = raw === "owner" ? "owner" : raw === "register" ? "register" : "client";
  const locale = req.nextUrl.searchParams.get("lang") === "fr" ? "fr" : "en";
  const state = encodeState(intent, locale);
  const redirectUri = `${APP_URL()}/api/auth/google/callback`;
  const codeVerifier = generateCodeVerifier();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
    code_challenge: computeCodeChallenge(codeVerifier),
    code_challenge_method: "S256",
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  );
  setSSOStateCookie(res, state);
  setPKCECookie(res, codeVerifier);
  return res;
}
