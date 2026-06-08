import { NextRequest, NextResponse } from "next/server";

const STAFF_PROTECTED  = ["/dashboard"];
const CLIENT_PROTECTED = ["/my/dashboard", "/my/messages"];
const AUTH_ONLY        = ["/login", "/register"];
const CLIENT_AUTH_ONLY = ["/my/login", "/my/register"];

// Admin subdomain enforcement (no-op without ADMIN_DOMAIN env var).
const ADMIN_DOMAIN = process.env.ADMIN_DOMAIN ?? '';
const MAIN_DOMAIN  = process.env.NEXT_PUBLIC_WEB_URL
  ? new URL(process.env.NEXT_PUBLIC_WEB_URL).hostname
  : '';

// Decode the user from the base64-encoded `booking_user` cookie (set at login).
function userFromCookie(req: NextRequest): { role?: string; mustResetPassword?: boolean } | null {
  const raw = req.cookies.get("booking_user")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(atob(decodeURIComponent(raw)));
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Subdomain routing: when ADMIN_DOMAIN is provisioned, /admin/* must be
  // served from that subdomain and all other paths from the main domain.
  if (ADMIN_DOMAIN && MAIN_DOMAIN) {
    const host = req.headers.get('host') ?? '';
    if (pathname.startsWith('/admin') && host === MAIN_DOMAIN) {
      const dest = new URL(req.url);
      dest.hostname = ADMIN_DOMAIN;
      dest.protocol = 'https:';
      return NextResponse.redirect(dest, 308);
    }
    if (!pathname.startsWith('/admin') && host === ADMIN_DOMAIN) {
      const dest = new URL(req.url);
      dest.hostname = MAIN_DOMAIN;
      dest.protocol = 'https:';
      return NextResponse.redirect(dest, 308);
    }
  }
  // A session exists as long as the long-lived refresh cookie (7d) is present —
  // the 15-minute access cookie may have lapsed, but the app silently refreshes
  // it on the next API call. Gating on the access cookie alone bounced people to
  // login every 15 minutes; gate on either so navigation stays smooth.
  const authed = !!(req.cookies.get("booking_token")?.value || req.cookies.get("booking_refresh")?.value);
  const user = userFromCookie(req);

  // Forced first-login password reset: until the flag clears, keep the user on
  // /change-password and out of the dashboard area.
  if (
    authed && user?.mustResetPassword && pathname !== "/change-password" &&
    pathname.startsWith("/dashboard")
  ) {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }
  // /change-password itself requires a login.
  if (pathname === "/change-password" && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Platform admin area — must be logged in AND Role.ADMIN.
  if (pathname.startsWith("/admin")) {
    if (!authed) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (user?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (STAFF_PROTECTED.some((p) => pathname.startsWith(p)) && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (CLIENT_PROTECTED.some((p) => pathname.startsWith(p)) && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/my/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already signed in and hitting an auth page → send to the right workspace.
  if (AUTH_ONLY.includes(pathname) && authed) {
    const home = user?.role === "ADMIN"
      ? "/admin"
      : user?.role === "CLIENT"
        ? "/my/dashboard"
        : "/dashboard";
    return NextResponse.redirect(new URL(home, req.url));
  }

  if (CLIENT_AUTH_ONLY.includes(pathname) && authed) {
    return NextResponse.redirect(new URL("/my/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/change-password",
    "/my/dashboard", "/my/messages",
    "/my/login", "/my/register",
    "/login", "/register",
  ],
};
