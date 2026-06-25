import type { Metadata } from "next";
import { ComparePage } from "@/components/ComparePage";

export const metadata: Metadata = {
  title: "Pulse vs. Acuity Scheduling | Canada-First Alternative",
  description: "Compare Pulse and Acuity Scheduling for Canadian service businesses. CAD pricing, active development, no Squarespace account required, and automated no-show protection.",
};

export default function VsAcuityPage() {
  return (
    <ComparePage
      competitor="Acuity Scheduling"
      tagline="Pulse vs. Acuity Scheduling"
      summary="Acuity was a great tool — before Squarespace acquired it. Development has stalled, support has deteriorated, and users report a frustrating forced re-login bug. Pulse is actively built for Canadian service businesses with CAD pricing and no USD conversion surprises."
      pulseWins={[
        "CAD pricing — Acuity bills in USD, adding ~37% at current exchange",
        "Actively developed — no Squarespace acquisition freeze",
        "No forced re-login bug (Acuity reports sessions expiring mid-day)",
        "PIPEDA & CASL compliance built in",
        "Automatic no-show fee charging — Acuity only collects deposits",
        "Revenue Protected metric shows exactly what you've recovered",
        "Birthday and win-back campaign automation",
        "No CSS/HTML skills required for customization",
        "Canada-first support team",
      ]}
      theyWin={[
        "Squarespace website builder integration",
        "Larger user review base",
        "More third-party app integrations",
        "Established brand recognition",
      ]}
      features={[
        { feature: "Online booking page",            pulse: true,  them: true },
        { feature: "CAD pricing",                   pulse: true,  them: false, highlight: true },
        { feature: "PIPEDA/CASL compliance tools",  pulse: true,  them: false, highlight: true },
        { feature: "No-show fee auto-charge",       pulse: true,  them: "Partial" },
        { feature: "Active product development",    pulse: true,  them: false, highlight: true },
        { feature: "No forced re-login bug",        pulse: true,  them: false, highlight: true },
        { feature: "Deposits at booking",           pulse: true,  them: true },
        { feature: "SMS reminders",                 pulse: true,  them: true },
        { feature: "Client intake forms",           pulse: true,  them: true },
        { feature: "Gift cards",                    pulse: true,  them: true },
        { feature: "Packages / credits",            pulse: true,  them: true },
        { feature: "Memberships",                   pulse: true,  them: true },
        { feature: "Google Calendar sync",          pulse: true,  them: true },
        { feature: "Multi-staff scheduling",        pulse: true,  them: true },
        { feature: "Revenue Protected dashboard",   pulse: true,  them: false, highlight: true },
        { feature: "Birthday campaign automation",  pulse: true,  them: false },
        { feature: "Win-back campaign automation",  pulse: true,  them: false },
        { feature: "Customization without code",    pulse: true,  them: false },
        { feature: "Squarespace integration",       pulse: false, them: true },
      ]}
      pricingComparison={{
        pulseLabel: "Pro plan — everything included",
        pulsePrice: "$39/mo",
        pulseCurrency: "CAD · No contracts · No USD conversion",
        themLabel: "Powerhouse plan",
        themPrice: "$61/mo",
        themCurrency: "USD — ~$83 CAD at current exchange",
        themNote: "Price changes monthly with CAD/USD exchange rate",
      }}
    />
  );
}
