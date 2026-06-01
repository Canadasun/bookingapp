import { NextResponse } from "next/server";

// Lightweight liveness probe for the platform health check.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", service: "booking-web" });
}
