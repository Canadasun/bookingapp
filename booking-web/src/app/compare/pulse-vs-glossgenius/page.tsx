import type { Metadata } from "next";
import { ComparePage } from "@/components/ComparePage";

export const metadata: Metadata = {
  title: "Pulse vs. GlossGenius | Canada-First Alternative",
  description: "Compare Pulse and GlossGenius. CAD pricing, PIPEDA compliance, and no USD conversion. The Canada-first alternative to GlossGenius for beauty and service professionals.",
};

export default function VsGlossGeniusPage() {
  return (
    <ComparePage
      competitor="GlossGenius"
      tagline="Pulse vs. GlossGenius"
      summary="GlossGenius is a polished platform built primarily for the US beauty market. Pulse brings the same quality of experience to Canadian service businesses — with CAD pricing, PIPEDA compliance, and no USD conversion headaches."
      pulseWins={[
        "Prices in CAD — GlossGenius is USD-only",
        "PIPEDA and CASL compliance built in",
        "GST/HST on invoices without manual workarounds",
        "Multi-staff and multi-location support",
        "Available to all Canadian service industries, not just beauty",
        "No app store lock-in — web and mobile",
      ]}
      theyWin={[
        "Polished mobile-first design for solo beauty pros",
        "Stronger US market presence and reviews",
        "Integrated website builder",
        "Social media story cards for Instagram",
      ]}
      features={[
        { feature: "Online booking page", pulse: true, them: true },
        { feature: "CAD pricing", pulse: true, them: false, highlight: true },
        { feature: "PIPEDA/CASL compliance", pulse: true, them: false, highlight: true },
        { feature: "GST/HST on invoices", pulse: true, them: false, highlight: true },
        { feature: "Deposits at booking", pulse: true, them: true },
        { feature: "No-show fee auto-charge", pulse: true, them: true },
        { feature: "SMS reminders", pulse: true, them: true },
        { feature: "Client profiles", pulse: true, them: true },
        { feature: "Gift cards", pulse: true, them: true },
        { feature: "Memberships and packages", pulse: true, them: true },
        { feature: "Multi-staff scheduling", pulse: true, them: true },
        { feature: "Multi-location", pulse: true, them: false },
        { feature: "Birthday campaigns", pulse: true, them: true },
        { feature: "Revenue Protected metric", pulse: true, them: false, highlight: true },
        { feature: "Social bio page", pulse: true, them: false },
        { feature: "Integrated website builder", pulse: false, them: true },
        { feature: "Story card generator", pulse: false, them: true },
      ]}
      pricingComparison={{
        pulseLabel: "Pro plan",
        pulsePrice: "$69/mo",
        pulseCurrency: "CAD · No contracts",
        themLabel: "Standard plan",
        themPrice: "$48/mo",
        themCurrency: "USD — ~$65 CAD",
        themNote: "USD only — price changes with exchange rate",
      }}
    />
  );
}
