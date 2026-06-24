import type { Metadata } from "next";
import { ComparePage } from "@/components/ComparePage";

export const metadata: Metadata = {
  title: "Pulse vs. Square Appointments | Best Canadian Booking Software",
  description: "Compare Pulse and Square Appointments. CAD pricing, PIPEDA compliance, no-show deposits, and no hardware required. Which is right for Canadian service businesses?",
};

export default function VsSquarePage() {
  return (
    <ComparePage
      competitor="Square Appointments"
      tagline="Pulse vs. Square Appointments"
      summary="Square is great for businesses that need point-of-sale hardware. Pulse is built for service businesses that book online first — with Canadian pricing, no-show protection, and PIPEDA-aware privacy built in."
      pulseWins={[
        "Prices in CAD — no currency conversion surprises",
        "No hardware required — 100% online booking focused",
        "PIPEDA-aware privacy with Canadian data practices",
        "CASL-compliant marketing consent built in",
        "GST/HST on every invoice automatically",
        "No per-transaction fees on the Pro plan",
        "Deposits and no-show fees without POS hardware",
      ]}
      theyWin={[
        "In-person POS hardware and tap-to-pay",
        "Larger brand recognition",
        "Inventory management for retail products",
        "US market penetration",
      ]}
      features={[
        { feature: "Online booking page", pulse: true, them: true },
        { feature: "CAD pricing", pulse: true, them: false, highlight: true },
        { feature: "GST/HST on invoices", pulse: true, them: false, highlight: true },
        { feature: "PIPEDA compliance tools", pulse: true, them: false, highlight: true },
        { feature: "CASL marketing consent", pulse: true, them: false, highlight: true },
        { feature: "Deposits at booking", pulse: true, them: true },
        { feature: "No-show fee auto-charge", pulse: true, them: "Partial" },
        { feature: "SMS reminders", pulse: true, them: true },
        { feature: "Google Calendar sync", pulse: true, them: true },
        { feature: "Gift cards", pulse: true, them: true },
        { feature: "Packages / pre-paid credits", pulse: true, them: true },
        { feature: "Memberships", pulse: true, them: true },
        { feature: "Client intake forms", pulse: true, them: true },
        { feature: "Multi-staff scheduling", pulse: true, them: true },
        { feature: "Revenue Protected metric", pulse: true, them: false, highlight: true },
        { feature: "POS hardware", pulse: false, them: true },
        { feature: "Inventory management", pulse: false, them: true },
        { feature: "No hardware required", pulse: true, them: false },
      ]}
      pricingComparison={{
        pulseLabel: "Pro plan",
        pulsePrice: "$69/mo",
        pulseCurrency: "CAD · No contracts",
        themLabel: "Plus plan (approx.)",
        themPrice: "$60/mo",
        themCurrency: "USD — ~$82 CAD",
        themNote: "+ per-transaction fees on lower tiers",
      }}
    />
  );
}
