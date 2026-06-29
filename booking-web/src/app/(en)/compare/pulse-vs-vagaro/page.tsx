import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { ComparePage } from "@/components/ComparePage";

export const metadata: Metadata = {
  alternates: buildAlternates("/compare/pulse-vs-vagaro"),
  title: "Pulse vs. Vagaro | Canada-First Alternative — CAD Pricing",
  description: "Compare Pulse and Vagaro for Canadian service businesses. CAD pricing, no per-add-on fees, clients book without creating an account, and no marketplace listing fees.",
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Compare", item: "https://www.pulseappointments.com/compare" },
    { "@type": "ListItem", position: 3, name: "Pulse vs. Vagaro", item: "https://www.pulseappointments.com/compare/pulse-vs-vagaro" },
  ],
};

export default function VsVagaroPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ComparePage
      competitor="Vagaro"
      tagline="Pulse vs. Vagaro"
      summary="Vagaro's real monthly cost is 2–3× the advertised price once you add forms, text marketing, and check-in tools. Pulse bundles everything your service business needs at one flat CAD price — and clients can book without creating an account."
      pulseWins={[
        "CAD pricing — Vagaro bills in USD, exposing you to exchange rate risk",
        "Clients book without creating an account — less friction, more bookings",
        "All features bundled — no à-la-carte add-ons for forms, SMS, or check-in",
        "No marketplace listing — your brand, not Vagaro's directory",
        "No per-booking marketplace commission",
        "Revenue Protected metric shows exactly how much you've recovered",
        "PIPEDA & CASL compliance built in",
        "No predatory early-cancellation fees",
      ]}
      theyWin={[
        "Vagaro marketplace for client discovery (US-focused)",
        "POS hardware integration",
        "Longer track record and larger US review base",
        "QuickBooks and Zoom integrations",
        "Staff commission tracking",
      ]}
      features={[
        { feature: "Online booking page",            pulse: true,  them: true },
        { feature: "CAD pricing",                    pulse: true,  them: false, highlight: true },
        { feature: "PIPEDA/CASL compliance",         pulse: true,  them: false, highlight: true },
        { feature: "Book without client account",    pulse: true,  them: false, highlight: true },
        { feature: "Deposits at booking",            pulse: true,  them: true },
        { feature: "No-show fee auto-charge",        pulse: true,  them: true },
        { feature: "SMS reminders (included)",       pulse: true,  them: "Add-on" },
        { feature: "Intake forms (included)",        pulse: true,  them: "Add-on" },
        { feature: "Text marketing (included)",      pulse: true,  them: "Add-on" },
        { feature: "Client profiles",               pulse: true,  them: true },
        { feature: "Gift cards",                    pulse: true,  them: true },
        { feature: "Memberships",                   pulse: true,  them: true },
        { feature: "Packages / credits",            pulse: true,  them: true },
        { feature: "Google Calendar sync",          pulse: true,  them: true },
        { feature: "Birthday campaigns",            pulse: true,  them: true },
        { feature: "Revenue Protected metric",      pulse: true,  them: false, highlight: true },
        { feature: "No marketplace listing fees",   pulse: true,  them: false },
        { feature: "Discovery marketplace",         pulse: false, them: true },
        { feature: "POS hardware",                  pulse: false, them: true },
      ]}
      pricingComparison={{
        pulseLabel: "Pro plan — everything included",
        pulsePrice: "$39/mo",
        pulseCurrency: "CAD · No contracts · No add-ons",
        themLabel: "Business plan + add-ons",
        themPrice: "$85+/mo",
        themCurrency: "USD — ~$115+ CAD",
        themNote: "Forms, SMS & check-in each billed separately",
      }}
    />
    </>
  );
}
