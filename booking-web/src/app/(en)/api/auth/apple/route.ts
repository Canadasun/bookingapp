import { NextRequest, NextResponse } from "next/server";
import {
  encodeState, setAppleSSOStateCookie,
  generateNonce, hashNonce, setSSONonceCookie,
  APP_URL, type SSOIntent,
} from "@/lib/sso-cookies";

export async function GET(req: NextRequest) {
  const clientId = process.env.APPLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Apple sign-in is not configured" }, { status: 503 });
  }

  const raw = req.nextUrl.searchParams.get("intent");
  const intent: SSOIntent = raw === "owner" ? "owner" : raw === "register" ? "register" : "client";
  const lang = req.nextUrl.searchParams.get("lang");
  const locale = lang === "fr" || lang === "en" ? lang : undefined;
  const state = encodeState(intent, locale);
  const redirectUri = `${APP_URL()}/api/auth/apple/callback`;
  const rawNonce = generateNonce();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code id_token",
    scope: "name email",
    response_mode: "form_post",
    state,
    nonce: hashNonce(rawNonce),
  });

  const res = NextResponse.redirect(
    `https://appleid.apple.com/auth/authorize?${params}`,
  );
  // Apple uses form_post (cross-site POST) — must use SameSite=None cookies.
  setAppleSSOStateCookie(res, state);
  setSSONonceCookie(res, rawNonce);
  return res;
}
