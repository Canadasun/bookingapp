import type { Metadata } from "next";
import { ComparePage } from "@/components/ComparePage";

export const metadata: Metadata = {
  title: "Pulse vs. Acuity Scheduling | Canada-First Alternative",
  description: "Compare Pulse and Acuity Scheduling for Canadian service businesses. CAD pricing, PIPEDA compliance, no-show protection, and no USD conversion.",
};

export default function VsAcuityPage() {
  return (
    <ComparePage
      competitor="Acuity Scheduling"
      tagline="Pulse vs. Acuity Scheduling"
      summary="Acuity is a solid booking tool owned by Squarespace. Pulse is purpose-built for Canadian service businesses — with CAD pricing, PIPEDA compliance, and a no-show protection system that actually shows you the money it saved."
      pulseWins={[
        "Prices in CAD — no monthly USD conversion guessing",
        "PIPEDA and CASL compliance built in",
        "Revenue Protected metric shows your no-show savings",
        "Birthday and win-back campaign automation",
        "Client portal with self-service history",
        "Real-time WebSocket dashboard updates",
        "Canada-first support and pricing transparency",
      ]}
      theyWin={[
        "Squarespace website builder integration",
        "Longer track record and larger user reviews",
        "More third-party app integrations",
      ]}
      features={[
        { feature: "Online booking page", pulse: true, them: true },
        { feature: "CAD pricing", pulse: true, them: false, highlight: true },
        { feature: "PIPEDA/CASL compliance tools", pulse: true, them: false, highlight: true },
        { feature: "Deposits at booking", pulse: true, them: true },
        { feature: "No-show fee auto-charge", pulse: true, them: "Partial" },
        { feature: "SMS reminders", pulse: true, them: true },
        { feature: "Client intake forms", pulse: true, them: true },
        { feature: "Gift cards", pulse: true, them: true },
        { feature: "Packages / credits", pulse: true, them: true },
        { feature: "Memberships", pulse: true, them: true },
        { feature: "Google Calendar sync", pulse: true, them: true },
        { feature: "Multi-staff scheduling", pulse: true, them: true },
        { feature: "Revenue Protected dashboard", pulse: true, them: false, highlight: true },
        { feature: "Birthday campaign automation", pulse: true, them: false },
        { feature: "Win-back campaign automation", pulse: true, them: false },
        { feature: "Real-time dashboard", pulse: true, them: false },
        { feature: "Squarespace integration", pulse: false, them: true },
      ]}
      pricingComparison={{
        pulseLabel: "Pro plan",
        pulsePrice: "$69/mo",
        pulseCurrency: "CAD · No contracts",
        themLabel: "Growing plan",
        themPrice: "$34/mo",
        themCurrency: "USD — ~$46 CAD",
        themNote: "Grows to $61 USD (~$83 CAD) at higher tier",
      }}
    />
  );
}
