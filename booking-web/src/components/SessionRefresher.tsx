"use client";

import { useEffect } from "react";

// Proactively refreshes the session before the 15-min access token expires.
// Without this, idle pages (no outgoing API calls) never trigger the 401 path
// in /api/auth/me that swaps the expired token, so the booking_user hint cookie
// silently expires and the UI treats the user as logged out — even though their
// 7-day refresh token is still valid.
export function SessionRefresher() {
  useEffect(() => {
    const id = setInterval(() => {
      fetch("/api/auth/me").catch(() => {});
    }, 12 * 60 * 1000); // 12 min — 3 min before the 15-min token window closes
    return () => clearInterval(id);
  }, []);
  return null;
}
