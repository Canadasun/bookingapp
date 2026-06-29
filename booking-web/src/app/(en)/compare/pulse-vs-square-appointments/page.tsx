import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { ComparePage } from "@/components/ComparePage";

export const metadata: Metadata = {
  alternates: buildAlternates("/compare/pulse-vs-square-appointments"),
  title: "Pulse vs. Square Appointments | CAD Pricing Alternative",
  description: "Compare Pulse and Square Appointments for Canadian service businesses. CAD pricing, no hardware required, PIPEDA compliance, and no-show protection without a POS terminal.",
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Compare", item: "https://www.pulseappointments.com/compare" },
    { "@type": "ListItem", position: 3, name: "Pulse vs. Square Appointments", item: "https://www.pulseappointments.com/compare/pulse-vs-square-appointments" },
  ],
};

export default function VsSquarePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ComparePage
      competitor="Square Appointments"
      tagline="Pulse vs. Square Appointments"
      summary="Square is great if you need a physical POS terminal. Pulse is for service businesses that book online first — mobile therapists, lash artists, trainers, and cleaners who don't want to be squeezed into a retail-shaped product."
      pulseWins={[
        "CAD pricing — Square exposes you to USD currency risk",
        "No hardware required — 100% online booking",
        "Your payment processor choice — not locked into Square's rates",
        "No-show fee auto-charge without POS hardware",
        "PIPEDA & CASL compliance built in",
        "GST/HST on every invoice automatically",
        "No per-transaction fees on Pro plan",
        "Revenue Protected metric tracks your no-show savings",
        "Flat pricing — Square escalates steeply with more staff",
      ]}
      theyWin={[
        "In-person POS hardware and tap-to-pay",
        "Inventory management for retail products",
        "Larger brand recognition",
        "US market penetration",
      ]}
      features={[
        { feature: "Online booking page",            pulse: true,  them: true },
        { feature: "CAD pricing",                   pulse: true,  them: false, highlight: true },
        { feature: "GST/HST on invoices",           pulse: true,  them: false, highlight: true },
        { feature: "PIPEDA compliance tools",       pulse: true,  them: false, highlight: true },
        { feature: "CASL marketing consent",        pulse: true,  them: false, highlight: true },
        { feature: "No hardware required",          pulse: true,  them: false, highlight: true },
        { feature: "Your payment processor",        pulse: true,  them: false, highlight: true },
        { feature: "Deposits at booking",           pulse: true,  them: true },
        { feature: "No-show fee auto-charge",       pulse: true,  them: "Partial" },
        { feature: "SMS reminders",                 pulse: true,  them: true },
        { feature: "Google Calendar sync",          pulse: true,  them: true },
        { feature: "Gift cards",                    pulse: true,  them: true },
        { feature: "Packages / pre-paid credits",   pulse: true,  them: true },
        { feature: "Memberships",                   pulse: true,  them: true },
        { feature: "Client intake forms",           pulse: true,  them: true },
        { feature: "Multi-staff scheduling",        pulse: true,  them: true },
        { feature: "Revenue Protected metric",      pulse: true,  them: false, highlight: true },
        { feature: "Flat staff pricing",            pulse: true,  them: false },
        { feature: "POS hardware",                  pulse: false, them: true },
        { feature: "Inventory management",          pulse: false, them: true },
      ]}
      pricingComparison={{
        pulseLabel: "Pro plan — unlimited staff",
        pulsePrice: "$39/mo",
        pulseCurrency: "CAD · No contracts · No per-transaction fee",
        themLabel: "Plus plan (6–10 staff)",
        themPrice: "$80/mo",
        themCurrency: "USD — ~$110 CAD",
        themNote: "+ mandatory Square payment processing fees on every transaction",
      }}
    />
    </>
  );
}
