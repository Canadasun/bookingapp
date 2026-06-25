import { NextRequest, NextResponse } from "next/server";
import { encodeState, setSSOStateCookie, APP_URL } from "@/lib/sso-cookies";

export async function GET(req: NextRequest) {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Apple sign-in is not configured" }, { status: 503 });
  }

  const intent = req.nextUrl.searchParams.get("intent") === "owner" ? "owner" : "client";
  const state = encodeState(intent);
  const redirectUri = `${APP_URL()}/api/auth/apple/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code id_token",
    scope: "name email",
    response_mode: "form_post",
    state,
  });

  const res = NextResponse.redirect(
    `https://appleid.apple.com/auth/authorize?${params}`,
  );
  setSSOStateCookie(res, state);
  return res;
}
