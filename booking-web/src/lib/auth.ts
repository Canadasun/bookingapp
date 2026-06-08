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
}

export function getUser(): SessionUser | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)booking_user=([^;]+)/);
  if (!match) return null;
  try { return JSON.parse(atob(decodeURIComponent(match[1]))) as SessionUser; }
  catch { return null; }
}

export function clearSession() {
  for (const name of ["booking_token", "booking_user"]) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}
