import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Prices default to CAD (the platform's primary market); pass "USD" for US
// businesses. Using the en-US locale renders CAD as "CA$" and USD as "$", so the
// two are visually distinct.
export function formatPrice(cents: number, currency: "CAD" | "USD" = "CAD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)booking_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearToken() {
  document.cookie = "booking_token=; Max-Age=0; path=/";
  document.cookie = "booking_user=; Max-Age=0; path=/";
}

// Only allow same-origin internal paths as post-login redirect targets.
// Rejects protocol-relative ("//evil.com") and "/\\evil.com" open-redirect tricks.
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (next && /^\/(?![/\\])/.test(next)) return next;
  return fallback;
}
