import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// In-process sliding-window rate limiter for BFF auth routes.
// Protects against bots hammering /api/auth/* before requests reach the
// NestJS layer (which also throttles, but at the cost of an internal round-trip).
// Railway deploys Next.js as a Node.js process — globalThis persists across
// requests for the lifetime of the process, so the counter is accurate per worker.
// NOTE: This counter is process-local. Under horizontal scaling (multiple Node.js
// workers or containers) each process tracks its own window, so the effective limit
// per client IP is limit × worker-count. The NestJS throttler acts as the authoritative
// backend-side guard; this middleware is a cheap early-exit, not a strict ceiling.
const WINDOW_MS = 60_000;
const MAX_REQUESTS: Record<string, number> = {
  "/api/auth/login":          10,
  "/api/auth/register":       5,
  "/api/auth/forgot-password": 5,
  "/api/auth/refresh":        30,
};

type Entry = { count: number; resetAt: number };
const g = globalThis as typeof globalThis & { _pulseAuthRL?: Map<string, Entry> };
if (!g._pulseAuthRL) g._pulseAuthRL = new Map();
const hits = g._pulseAuthRL;

function check(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (++entry.count > limit) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const limit = MAX_REQUESTS[pathname];
  if (limit === undefined) return NextResponse.next();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (check(`${pathname}:${ip}`, limit)) {
    return new NextResponse(JSON.stringify({ error: "Too many requests. Please wait a minute and try again." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60" },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/refresh"],
};
