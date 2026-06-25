"use client";

import { useEffect } from "react";
import { getUser } from "@/lib/auth";

// Proactively refreshes the session before the 15-min access token expires.
// Without this, idle pages (no outgoing API calls) never trigger the 401 path
// in /api/auth/me that swaps the expired token, so the booking_user hint cookie
// silently expires and the UI treats the user as logged out — even though their
// 7-day refresh token is still valid.
//
// Only runs when the user appears authenticated (booking_user cookie present)
// so unauthenticated visitors on public pages don't generate background 401s.
export function SessionRefresher() {
  useEffect(() => {
    if (!getUser()) return;
    // Fire once immediately to handle sessions that are already near expiry
    // at the time the page loads, then keep the interval running.
    fetch("/api/auth/me").catch(() => {});
    const id = setInterval(() => {
      fetch("/api/auth/me").catch(() => {});
    }, 12 * 60 * 1000); // 12 min — 3 min before the 15-min token window closes
    return () => clearInterval(id);
  }, []);
  return null;
}
