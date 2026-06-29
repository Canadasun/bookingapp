import type { Metadata } from "next";
import { ComparePage } from "@/components/ComparePage";

export const metadata: Metadata = {
  title: "Pulse vs. GlossGenius | Canadian CAD Pricing Alternative",
  description: "GlossGenius is built for US salons only. Pulse is built for Canadian service businesses — CAD pricing, PIPEDA compliance, multi-location support, and no USD conversion headaches.",
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Compare", item: "https://www.pulseappointments.com/compare" },
    { "@type": "ListItem", position: 3, name: "Pulse vs. GlossGenius", item: "https://www.pulseappointments.com/compare/pulse-vs-glossgenius" },
  ],
};

export default function VsGlossGeniusPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ComparePage
      competitor="GlossGenius"
      tagline="Pulse vs. GlossGenius"
      summary="GlossGenius is a polished US-only beauty platform. It doesn't officially operate in Canada — there's no CAD billing, no PIPEDA compliance, no Canadian support, and no multi-location tools. Pulse delivers the same premium experience purpose-built for Canadian service businesses."
      pulseWins={[
        "Available in Canada — GlossGenius is US-only",
        "CAD pricing — GlossGenius is USD-only with no Canadian billing",
        "PIPEDA & CASL compliance built in",
        "GST/HST on invoices without manual workarounds",
        "Multi-location support — GlossGenius is single-location only",
        "Canadian support team who understand your market",
        "No USD exchange rate surprises on your monthly bill",
        "Revenue Protected metric unique to Pulse",
      ]}
      theyWin={[
        "Polished mobile-first design for solo US beauty pros",
        "Integrated website builder",
        "Social media story card generator",
        "Strong brand in the US beauty market",
      ]}
      features={[
        { feature: "Available in Canada",             pulse: true,  them: false, highlight: true },
        { feature: "CAD pricing",                     pulse: true,  them: false, highlight: true },
        { feature: "PIPEDA/CASL compliance",          pulse: true,  them: false, highlight: true },
        { feature: "GST/HST on invoices",             pulse: true,  them: false, highlight: true },
        { feature: "Multi-location support",          pulse: true,  them: false, highlight: true },
        { feature: "Online booking page",             pulse: true,  them: true },
        { feature: "Deposits at booking",             pulse: true,  them: true },
        { feature: "No-show fee auto-charge",         pulse: true,  them: true },
        { feature: "SMS reminders",                   pulse: true,  them: true },
        { feature: "Client profiles",                 pulse: true,  them: true },
        { feature: "Gift cards",                      pulse: true,  them: true },
        { feature: "Memberships and packages",        pulse: true,  them: true },
        { feature: "Multi-staff scheduling",          pulse: true,  them: true },
        { feature: "Birthday campaigns",              pulse: true,  them: true },
        { feature: "Revenue Protected metric",        pulse: true,  them: false, highlight: true },
        { feature: "Social bio page",                 pulse: true,  them: false },
        { feature: "Integrated website builder",      pulse: false, them: true },
        { feature: "Story card generator",            pulse: false, them: true },
      ]}
      pricingComparison={{
        pulseLabel: "Pro plan — Canada-native",
        pulsePrice: "$39/mo",
        pulseCurrency: "CAD · PIPEDA compliant · Multi-location",
        themLabel: "Gold plan (USD only)",
        themPrice: "$48/mo",
        themCurrency: "USD — ~$65 CAD · No Canadian support",
        themNote: "Not officially available in Canada",
      }}
    />
    </>
  );
}
