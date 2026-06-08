export function apiBase() {
  // Prefer internal (free, no public egress); fall back to public domain if
  // API_INTERNAL_URL is not configured (e.g. Railway private networking not set up).
  const raw = process.env.API_INTERNAL_URL
    ?? process.env.NEXT_PUBLIC_API_URL
    ?? "http://localhost:3001";
  return raw.replace(/\/+$/, "").replace(/\/api$/, "") + "/api";
}
