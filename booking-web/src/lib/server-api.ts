export function apiBase() {
  const raw = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  return raw.replace(/\/+$/, "").replace(/\/api$/, "") + "/api";
}
