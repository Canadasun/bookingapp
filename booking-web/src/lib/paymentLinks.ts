import { cache } from "react";

// Resolved Stripe Payment Link URLs per paid plan/interval, served by the API
// (GET /api/payments/plan-links). The marketing pricing page sends logged-out
// visitors straight to these hosted links; the in-dashboard upgrade flow uses
// Checkout Sessions instead.
export type PlanLinks = Record<"BASIC" | "PRO" | "UNLIMITED", { month?: string; year?: string } | undefined>;

const API_INTERNAL = (
  process.env.API_INTERNAL_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? "http://localhost:3001"
).replace(/\/+$/, "").replace(/\/api$/, "");

// Cached for an hour (the URLs are stable). Any failure resolves to an empty
// map so the pricing CTAs fall back to the /register links — the page must
// never break because Stripe or the API is briefly unavailable.
export const getPlanLinks = cache(async (): Promise<Partial<PlanLinks>> => {
  try {
    const res = await fetch(`${API_INTERNAL}/api/payments/plan-links`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return {};
    return (await res.json()) as Partial<PlanLinks>;
  } catch {
    return {};
  }
});
