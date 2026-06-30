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
  avatarUrl?: string | null;
  permissions?: string[];
  emailVerified?: boolean;    // not in cookie; available from useCurrentUser()
  twoFactorEnabled?: boolean; // not in cookie; available from useCurrentUser()
  twoFactorMethod?: "EMAIL" | "SMS";
  mustResetPassword?: boolean; // not in cookie; enforced server-side by API
  locale?: "en" | "fr";
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

export function updateCurrentUser(user: SessionUser) {
  _cache = user;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<SessionUser>("pulse-current-user", { detail: user }));
  }
}

export function patchCurrentUser(patch: Partial<SessionUser>) {
  if (!_cache) return;
  updateCurrentUser({ ..._cache, ...patch });
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
      if (!u) {
        const next = window.location.pathname + window.location.search;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      }
    });
  }, [router]);

  useEffect(() => {
    function onUser(e: Event) {
      setUser((e as CustomEvent<SessionUser>).detail);
    }
    window.addEventListener("pulse-current-user", onUser);
    return () => window.removeEventListener("pulse-current-user", onUser);
  }, []);

  return { user, loading };
}

// Read the minimal hint from the booking_user cookie — available immediately
// without an API round-trip. Carries { id, name, role, businessId, staffId,
// permissions } but NOT email, emailVerified, mustResetPassword, or 2FA fields.
// Use useCurrentUser() when those fields are needed.
//
// SECURITY NOTE: The HMAC signature on this cookie can only be verified
// server-side (COOKIE_SIGN_SECRET is never sent to the browser). This function
// strips the signature and validates the payload shape, but cannot
// cryptographically authenticate it. Never gate a security-sensitive action
// solely on the value returned here — always use useCurrentUser() or an API
// call for authoritative auth checks. All real authorization is enforced by
// the NestJS JWT guards on the backend.
export function getUser(): SessionUser | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)booking_user=([^;]+)/);
  if (!match) return null;
  try {
    let raw = decodeURIComponent(match[1]);
    // Strip the HMAC signature suffix (.base64sig appended by signCookieValue).
    const dot = raw.lastIndexOf(".");
    if (dot !== -1) raw = raw.slice(0, dot);
    const parsed = JSON.parse(atob(raw)) as unknown;
    // Validate the expected shape so a malformed or obviously-tampered cookie
    // returns null rather than being silently cast to SessionUser.
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as Record<string, unknown>).id !== "string" ||
      typeof (parsed as Record<string, unknown>).name !== "string" ||
      typeof (parsed as Record<string, unknown>).role !== "string" ||
      !["ADMIN", "OWNER", "STAFF", "CLIENT"].includes(
        (parsed as Record<string, unknown>).role as string,
      )
    ) return null;
    return parsed as SessionUser;
  } catch { return null; }
}

export function clearSession() {
  invalidateCurrentUser();
  // booking_td is HttpOnly and cannot be cleared by JS — it is cleared
  // server-side by the logout route. Only non-HttpOnly cookies are listed here.
  for (const name of ["booking_token", "booking_refresh", "booking_user"]) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}
