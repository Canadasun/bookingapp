export function apiBase() {
  // Server-only: never use NEXT_PUBLIC_* here — those values are baked into the
  // client bundle and would expose internal Railway hostnames to browsers.
  // API_INTERNAL_URL is the private network address (free, no egress).
  const raw = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  return raw.replace(/\/+$/, "").replace(/\/api$/, "") + "/api";
}
