import type { Metadata } from "next";
import { ComparePage } from "@/components/ComparePage";

export const metadata: Metadata = {
  title: "Pulse vs. Calendly | CAD Pricing for Service Businesses",
  description: "Calendly books meetings. Pulse books services. Compare deposits, no-show fees, client management, payments, and CAD pricing — everything Calendly doesn't have.",
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Compare", item: "https://www.pulseappointments.com/compare" },
    { "@type": "ListItem", position: 3, name: "Pulse vs. Calendly", item: "https://www.pulseappointments.com/compare/pulse-vs-calendly" },
  ],
};

export default function VsCalendlyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ComparePage
      competitor="Calendly"
      tagline="Pulse vs. Calendly"
      summary="Calendly schedules meetings. Pulse runs service businesses. If you need deposits, no-show protection, client management, SMS reminders, gift cards, and CAD billing — Calendly can't help you with any of that."
      pulseWins={[
        "Deposits & card-on-file — Calendly has zero payment protection",
        "No-show fee auto-charged to client's saved card",
        "Client profiles with full visit history and notes",
        "SMS reminders included — Calendly charges extra for Workflows",
        "CAD pricing — Calendly bills in USD (~37% premium at current rates)",
        "PIPEDA & CASL compliance for Canadian businesses",
        "Gift cards, packages, and memberships built in",
        "Revenue Protected metric shows no-show savings",
        "Birthday and win-back campaigns",
        "No per-seat pricing — one flat monthly price",
      ]}
      theyWin={[
        "Deeper CRM integrations (HubSpot, Salesforce, Zoom)",
        "Round-robin and team scheduling for sales teams",
        "Zapier / Make integration",
        "Larger corporate user base",
      ]}
      features={[
        { feature: "Online booking page",              pulse: true,  them: true },
        { feature: "Deposits at booking",              pulse: true,  them: false, highlight: true },
        { feature: "No-show fee auto-charge",          pulse: true,  them: false, highlight: true },
        { feature: "Card-on-file for no-shows",        pulse: true,  them: false, highlight: true },
        { feature: "Client profiles and history",      pulse: true,  them: false, highlight: true },
        { feature: "SMS reminders (included)",         pulse: true,  them: "Add-on" },
        { feature: "CAD pricing",                      pulse: true,  them: false, highlight: true },
        { feature: "PIPEDA/CASL compliance",           pulse: true,  them: false, highlight: true },
        { feature: "Gift cards",                       pulse: true,  them: false },
        { feature: "Memberships and packages",         pulse: true,  them: false },
        { feature: "Birthday campaigns",               pulse: true,  them: false },
        { feature: "Win-back campaigns",               pulse: true,  them: false },
        { feature: "Revenue analytics",               pulse: true,  them: false },
        { feature: "Flat monthly pricing",             pulse: true,  them: false },
        { feature: "Google Calendar sync",             pulse: true,  them: true },
        { feature: "Intake forms",                     pulse: true,  them: true },
        { feature: "Multi-staff scheduling",           pulse: true,  them: true },
        { feature: "Mobile app",                       pulse: true,  them: true },
        { feature: "CRM integrations (HubSpot, etc)", pulse: false, them: true },
        { feature: "Zapier integration",               pulse: false, them: true },
      ]}
      pricingComparison={{
        pulseLabel: "Pro plan — full service-business suite",
        pulsePrice: "$39/mo",
        pulseCurrency: "CAD · All features included",
        themLabel: "Teams plan (per seat)",
        themPrice: "$20/seat/mo",
        themCurrency: "USD — ~$27 CAD per user",
        themNote: "No deposits, no client mgmt, no payments at any tier",
      }}
    />
    </>
  );
}
