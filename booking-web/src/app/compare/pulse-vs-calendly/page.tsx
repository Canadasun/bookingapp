import type { Metadata } from "next";
import { ComparePage } from "@/components/ComparePage";

export const metadata: Metadata = {
  title: "Pulse vs. Calendly | Best Alternative for Service Businesses",
  description: "Compare Pulse and Calendly for service businesses. Deposits, no-show protection, client management, payments — features Calendly doesn't have.",
};

export default function VsCalendlyPage() {
  return (
    <ComparePage
      competitor="Calendly"
      tagline="Pulse vs. Calendly"
      summary="Calendly is excellent for scheduling meetings. Pulse is built for service businesses that need deposits, payments, client management, reminders, and no-show protection — not just meeting links."
      pulseWins={[
        "Deposits and card-on-file — Calendly has no payment protection",
        "No-show fee auto-charge to client's card",
        "Client profiles with visit history and notes",
        "SMS reminders included (Calendly requires Workflows add-on)",
        "CAD pricing — Calendly prices in USD",
        "PIPEDA and CASL compliance for Canadian businesses",
        "Gift cards, packages, and memberships",
        "Revenue Protected dashboard metric",
        "Staff commission tracking",
        "Google review automation",
      ]}
      theyWin={[
        "Deeper integrations (HubSpot, Salesforce, Zoom)",
        "Round-robin and team scheduling for sales teams",
        "Zapier integration",
        "Larger user base for corporate use cases",
      ]}
      features={[
        { feature: "Online booking page", pulse: true, them: true },
        { feature: "Deposits at booking", pulse: true, them: false, highlight: true },
        { feature: "No-show fee auto-charge", pulse: true, them: false, highlight: true },
        { feature: "Client profiles and history", pulse: true, them: false, highlight: true },
        { feature: "SMS reminders", pulse: true, them: "Add-on" },
        { feature: "CAD pricing", pulse: true, them: false, highlight: true },
        { feature: "PIPEDA/CASL compliance", pulse: true, them: false, highlight: true },
        { feature: "Gift cards", pulse: true, them: false },
        { feature: "Memberships and packages", pulse: true, them: false },
        { feature: "Google Calendar sync", pulse: true, them: true },
        { feature: "Intake forms", pulse: true, them: true },
        { feature: "Multi-staff scheduling", pulse: true, them: true },
        { feature: "Mobile app", pulse: true, them: true },
        { feature: "Revenue analytics", pulse: true, them: false },
        { feature: "Zapier integration", pulse: false, them: true },
        { feature: "CRM integrations (HubSpot, Salesforce)", pulse: false, them: true },
      ]}
      pricingComparison={{
        pulseLabel: "Pro plan (service businesses)",
        pulsePrice: "$69/mo",
        pulseCurrency: "CAD · Payments included",
        themLabel: "Teams plan",
        themPrice: "$20/seat/mo",
        themCurrency: "USD — ~$27 CAD per user",
        themNote: "No deposits, no client management included",
      }}
    />
  );
}
