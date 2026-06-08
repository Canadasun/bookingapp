import { NextRequest, NextResponse } from 'next/server';

// When ADMIN_DOMAIN is set (e.g. "admin.pulseappointments.com"), the admin
// panel is served exclusively from that subdomain. Accessing /admin/* from
// the main domain redirects to the admin subdomain, and vice-versa for
// non-admin paths arriving on the admin subdomain.
//
// Without ADMIN_DOMAIN set (dev / before subdomain is provisioned) this
// middleware is a no-op — everything works as before.
const ADMIN_DOMAIN = process.env.ADMIN_DOMAIN ?? '';
const MAIN_DOMAIN  = process.env.NEXT_PUBLIC_WEB_URL
  ? new URL(process.env.NEXT_PUBLIC_WEB_URL).hostname
  : '';

export function middleware(req: NextRequest) {
  if (!ADMIN_DOMAIN || !MAIN_DOMAIN) return NextResponse.next();

  const host    = req.headers.get('host') ?? '';
  const path    = req.nextUrl.pathname;
  const isAdmin = path.startsWith('/admin');

  // Request for /admin/* arriving on the main domain → send to admin subdomain
  if (isAdmin && host === MAIN_DOMAIN) {
    const dest = new URL(req.url);
    dest.hostname = ADMIN_DOMAIN;
    dest.protocol = 'https:';
    return NextResponse.redirect(dest, 308);
  }

  // Non-admin request arriving on the admin subdomain → send to main domain
  if (!isAdmin && host === ADMIN_DOMAIN) {
    const dest = new URL(req.url);
    dest.hostname = MAIN_DOMAIN;
    dest.protocol = 'https:';
    return NextResponse.redirect(dest, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)).*)',
  ],
};
