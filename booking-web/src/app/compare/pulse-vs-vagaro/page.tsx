import type { Metadata } from "next";
import { ComparePage } from "@/components/ComparePage";

export const metadata: Metadata = {
  title: "Pulse vs. Vagaro | Canada-First Alternative",
  description: "Compare Pulse and Vagaro for Canadian service businesses. CAD pricing, simpler setup, no-show protection, and no marketplace listing fees.",
};

export default function VsVagaroPage() {
  return (
    <ComparePage
      competitor="Vagaro"
      tagline="Pulse vs. Vagaro"
      summary="Vagaro is a feature-rich platform built primarily for the US market. Pulse is Canada-first — with CAD pricing, PIPEDA compliance, and a simpler setup that gets you taking bookings in under 5 minutes."
      pulseWins={[
        "Canada-first: CAD pricing, PIPEDA/CASL compliance",
        "No marketplace listing — your booking page, your brand",
        "Simpler setup — no overwhelming feature wall",
        "Revenue Protected metric unique to Pulse",
        "No per-booking processing fees on Pro plan",
        "Modern client portal and mobile booking experience",
      ]}
      theyWin={[
        "Vagaro marketplace for discovery (US-focused)",
        "POS hardware integration",
        "Longer track record in US/CA market",
        "More integrations (Zoom, QuickBooks)",
        "Staff commission tracking (Pulse is adding this)",
      ]}
      features={[
        { feature: "Online booking page", pulse: true, them: true },
        { feature: "CAD pricing", pulse: true, them: false, highlight: true },
        { feature: "PIPEDA/CASL compliance", pulse: true, them: false, highlight: true },
        { feature: "Deposits at booking", pulse: true, them: true },
        { feature: "No-show fee auto-charge", pulse: true, them: true },
        { feature: "SMS reminders", pulse: true, them: true },
        { feature: "Client profiles", pulse: true, them: true },
        { feature: "Gift cards", pulse: true, them: true },
        { feature: "Memberships", pulse: true, them: true },
        { feature: "Packages / credits", pulse: true, them: true },
        { feature: "Google Calendar sync", pulse: true, them: true },
        { feature: "Birthday campaigns", pulse: true, them: true },
        { feature: "Revenue Protected metric", pulse: true, them: false, highlight: true },
        { feature: "No marketplace fees", pulse: true, them: false },
        { feature: "Setup under 5 minutes", pulse: true, them: false },
        { feature: "Discovery marketplace", pulse: false, them: true },
        { feature: "POS hardware", pulse: false, them: true },
      ]}
      pricingComparison={{
        pulseLabel: "Pro plan",
        pulsePrice: "$69/mo",
        pulseCurrency: "CAD · No contracts",
        themLabel: "Business plan",
        themPrice: "$85/mo",
        themCurrency: "USD — ~$115 CAD",
        themNote: "+ add-on costs for some features",
      }}
    />
  );
}
