import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Prices default to CAD (the platform's primary market); pass "USD" for US
// businesses. Using the en-US locale renders CAD as "CA$" and USD as "$", so the
// two are visually distinct.
export function formatPrice(cents: number, currency: "CAD" | "USD" = "CAD", locale: "en-CA" | "fr-CA" = "en-CA") {
  return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(cents / 100);
}

export function formatDateTime(iso: string, locale: "en-CA" | "fr-CA" = "en-CA") {
  return new Date(iso).toLocaleString(locale, {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export function getUserHint(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)booking_user=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearToken() {
  // We can't clear HttpOnly cookies via JS, but we can clear the hint cookie
  // and the session will be terminated by the next 401 response or explicit logout.
  document.cookie = "booking_user=; Max-Age=0; path=/";
}

// Convert any stored phone value (E.164 or partial) to display format +1 (XXX) XXX-XXXX.
// Use this when loading a phone value from the API into a form field.
export function formatPhoneDisplay(stored: string | null | undefined): string {
  if (!stored) return "";
  return formatPhoneInput(stored);
}

// Format a phone number as the user types into +1 (XXX) XXX-XXXX.
// Strips everything except digits, then applies the North American format.
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^1/, "");
  if (digits.length === 0) return "";
  if (digits.length <= 3)  return `+1 (${digits}`;
  if (digits.length <= 6)  return `+1 (${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

// Normalise a displayed phone string back to E.164 (+1XXXXXXXXXX) for the API.
export function normalizePhoneE164(display: string): string {
  if (!display) return "";
  const digits = display.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return digits.length === 0 ? "" : display;
}

// Only allow same-origin page paths as post-login redirect targets.
// Rejects protocol-relative ("//evil.com"), "/\\evil.com", and internal /api/ routes.
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (next && /^\/(?![/\\])/.test(next) && !next.startsWith('/api/')) return next;
  return fallback;
}
