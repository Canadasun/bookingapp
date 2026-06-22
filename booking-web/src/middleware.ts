import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rate limiting for /api/auth/* routes is handled authoritatively by the
// NestJS ThrottlerGuard (Redis-backed, correct under horizontal scaling).
// A process-local counter in Next.js middleware is not reliable under
// multi-worker or multi-container deployments — effective limit becomes
// limit × worker-count — so we rely solely on the backend guard.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/refresh"],
};
