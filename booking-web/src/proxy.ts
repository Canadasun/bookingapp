import { NextRequest, NextResponse } from "next/server";

const STAFF_PROTECTED  = ["/dashboard"];
const CLIENT_PROTECTED = ["/my/dashboard", "/my/messages"];
const AUTH_ONLY        = ["/login", "/register"];
const CLIENT_AUTH_ONLY = ["/my/login", "/my/register"];

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
  const token = req.cookies.get("booking_token")?.value;
  const user = userFromCookie(req);

  // Forced first-login password reset: until the flag clears, keep the user on
  // /change-password and out of the dashboard area.
  if (
    token && user?.mustResetPassword && pathname !== "/change-password" &&
    pathname.startsWith("/dashboard")
  ) {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }
  // /change-password itself requires a login.
  if (pathname === "/change-password" && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Platform admin area — must be logged in AND Role.ADMIN.
  if (pathname.startsWith("/admin")) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (user?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  if (STAFF_PROTECTED.some((p) => pathname.startsWith(p)) && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (CLIENT_PROTECTED.some((p) => pathname.startsWith(p)) && !token) {
    const url = req.nextUrl.clone();
    url.pathname = "/my/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_ONLY.includes(pathname) && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (CLIENT_AUTH_ONLY.includes(pathname) && token) {
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
