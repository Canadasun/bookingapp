import { NextRequest, NextResponse } from "next/server";
import { encodeState, setSSOStateCookie, APP_URL } from "@/lib/sso-cookies";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 503 });
  }

  const intent = req.nextUrl.searchParams.get("intent") === "owner" ? "owner" : "client";
  const state = encodeState(intent);
  const redirectUri = `${APP_URL()}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  );
  setSSOStateCookie(res, state);
  return res;
}
