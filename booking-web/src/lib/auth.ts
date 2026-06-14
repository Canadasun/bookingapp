"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Fields stored in the booking_user hint cookie. Sensitive fields (email,
// mustResetPassword, emailVerified, twoFactorEnabled) are omitted — they
// come from useCurrentUser() which hits /api/auth/me.
export interface SessionUser {
  id: string;
  name: string;
  email?: string;             // not in cookie; available from useCurrentUser()
  role: "ADMIN" | "OWNER" | "STAFF" | "CLIENT";
  businessId: string | null;
  staffId: string | null;
  permissions?: string[];
  emailVerified?: boolean;    // not in cookie; available from useCurrentUser()
  twoFactorEnabled?: boolean; // not in cookie; available from useCurrentUser()
  twoFactorMethod?: "EMAIL" | "SMS";
  mustResetPassword?: boolean; // not in cookie; enforced server-side by API
}

// Module-level cache so the /api/auth/me fetch happens once per page-load.
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

// Authoritative hook — calls /api/auth/me, caches the result, redirects to
// /login if the session is invalid. Use this in layouts and auth-sensitive pages.
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

// Read the minimal hint from the booking_user cookie — available immediately
// without an API round-trip. Carries { id, name, role, businessId, staffId,
// permissions } but NOT email, emailVerified, mustResetPassword, or 2FA fields.
// Use useCurrentUser() when those fields are needed.
export function getUser(): SessionUser | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)booking_user=([^;]+)/);
  if (!match) return null;
  try {
    let raw = decodeURIComponent(match[1]);
    const dot = raw.lastIndexOf(".");
    if (dot !== -1) raw = raw.slice(0, dot);
    return JSON.parse(atob(raw)) as SessionUser;
  } catch { return null; }
}

export function clearSession() {
  invalidateCurrentUser();
  for (const name of ["booking_token", "booking_refresh", "booking_user"]) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}
