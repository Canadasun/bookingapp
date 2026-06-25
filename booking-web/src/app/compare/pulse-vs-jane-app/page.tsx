import type { Metadata } from "next";
import { ComparePage } from "@/components/ComparePage";

export const metadata: Metadata = {
  title: "Pulse vs. Jane App | For Non-Clinical Service Businesses",
  description: "Jane App is forcing a mandatory payment processor change. If you're a non-clinical service business — salon, spa, groomer, trainer — Pulse is built for you at a fraction of the cost.",
};

export default function VsJanePage() {
  return (
    <ComparePage
      competitor="Jane App"
      tagline="Pulse vs. Jane App"
      summary="Jane App is excellent for regulated health clinics that need SOAP notes and insurance billing. If you run a salon, spa, grooming studio, or wellness business, you're paying for clinical features you'll never use — and now Jane is forcing you onto their payment processor too."
      urgencyBanner={{
        icon: "⚠️",
        title: "Jane App is forcing a payment processor change (May 2026)",
        body: "Jane is making their own payment processor mandatory for all accounts. Businesses that preferred Stripe or other processors are being forced to switch or leave. Pulse uses Stripe Connect — you stay in control of your payments.",
      }}
      pulseWins={[
        "Flat-rate pricing — $39/mo for unlimited staff, no per-practitioner fee",
        "Built for beauty, wellness & service — not clinical health",
        "Stripe Connect payments — you choose, we don't lock you in",
        "Birthday & win-back campaign automation",
        "Gift cards, packages, and memberships",
        "Social bio page for Instagram and TikTok",
        "No-show fee auto-charge to card-on-file",
        "Revenue Protected metric unique to Pulse",
        "Cleaner client-facing booking flow",
        "5-minute setup — no clinical onboarding overhead",
      ]}
      theyWin={[
        "EHR / SOAP notes for regulated health professionals",
        "Insurance and direct billing (TELUS eClaims, etc.)",
        "Telehealth and video sessions",
        "Consent forms with e-signature",
        "Strong reputation in Canadian health clinics",
      ]}
      features={[
        { feature: "Online booking page",                pulse: true,  them: true },
        { feature: "CAD pricing",                        pulse: true,  them: true },
        { feature: "PIPEDA compliance",                  pulse: true,  them: true },
        { feature: "Flat-rate pricing (no per-staff fee)", pulse: true, them: false, highlight: true },
        { feature: "Stripe Connect (processor choice)",  pulse: true,  them: false, highlight: true },
        { feature: "Deposits at booking",                pulse: true,  them: true },
        { feature: "No-show fee auto-charge",            pulse: true,  them: "Partial" },
        { feature: "Gift cards",                         pulse: true,  them: false },
        { feature: "Memberships",                        pulse: true,  them: false },
        { feature: "Birthday campaigns",                 pulse: true,  them: false },
        { feature: "Win-back campaigns",                 pulse: true,  them: false },
        { feature: "Social bio page",                    pulse: true,  them: false, highlight: true },
        { feature: "Revenue Protected metric",           pulse: true,  them: false, highlight: true },
        { feature: "5-minute setup",                     pulse: true,  them: false, highlight: true },
        { feature: "EHR / SOAP notes",                   pulse: false, them: true },
        { feature: "Insurance direct billing",           pulse: false, them: true },
        { feature: "Telehealth video sessions",          pulse: false, them: true },
        { feature: "Consent forms with e-signature",     pulse: false, them: true },
      ]}
      pricingComparison={{
        pulseLabel: "Pro plan — unlimited staff",
        pulsePrice: "$39/mo",
        pulseCurrency: "CAD · Flat rate · No per-practitioner fee",
        themLabel: "4-practitioner team (base + 3 add-ons)",
        themPrice: "$196/mo",
        themCurrency: "CAD — $79 base + 3×$39 per practitioner",
        themNote: "Does not include Jane Payments processing fees",
      }}
    />
  );
}
