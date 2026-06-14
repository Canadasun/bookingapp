"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Minimal hint stored in the booking_user cookie — just enough for middleware
// routing and greeting the user on first paint. Full profile comes from useCurrentUser().
export interface UserHint {
  name: string;
  role: "ADMIN" | "OWNER" | "STAFF" | "CLIENT";
}

// Full profile returned by /api/auth/me — authoritative source of truth.
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "OWNER" | "STAFF" | "CLIENT";
  businessId: string | null;
  staffId: string | null;
  permissions?: string[];
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorMethod?: "EMAIL" | "SMS";
  mustResetPassword?: boolean;
}

// Module-level cache so the /api/auth/me fetch happens once per page-load
// and every useCurrentUser() call in the tree shares the same result.
let _cache: SessionUser | null = null;
let _promise: Promise<SessionUser | null> | null = null;

function fetchMe(): Promise<SessionUser | null> {
  if (_promise) return _promise;
  _promise = fetch("/api/auth/me")
    .then((r) => {
      if (!r.ok) { _promise = null; return null; }
      return r.json() as Promise<SessionUser>;
    })
    .then((u) => { _cache = u; _promise = null; return u; })
    .catch(() => { _promise = null; return null; });
  return _promise;
}

export function invalidateCurrentUser() {
  _cache = null;
  _promise = null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<SessionUser | null>(_cache);
  const [loading, setLoading] = useState(!_cache);
  const router = useRouter();

  useEffect(() => {
    if (_cache) { setUser(_cache); setLoading(false); return; }
    fetchMe().then((u) => {
      setUser(u);
      setLoading(false);
      if (!u) router.replace("/login");
    });
  }, [router]);

  return { user, loading };
}

// Read the minimal hint cookie — available immediately without an API call.
// Only contains { name, role }. Use useCurrentUser() for everything else.
export function getUser(): UserHint | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)booking_user=([^;]+)/);
  if (!match) return null;
  try {
    let raw = decodeURIComponent(match[1]);
    const dot = raw.lastIndexOf(".");
    if (dot !== -1) raw = raw.slice(0, dot);
    return JSON.parse(atob(raw)) as UserHint;
  } catch { return null; }
}

export function clearSession() {
  invalidateCurrentUser();
  for (const name of ["booking_token", "booking_refresh", "booking_user"]) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}
