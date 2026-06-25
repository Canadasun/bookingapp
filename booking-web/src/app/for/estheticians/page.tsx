import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { FileText, Package, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking Software for Estheticians | Pulse Appointments",
  description: "Esthetician booking with intake forms, package deals, deposits, and PIPEDA-aware health data handling. Canada-first, CAD pricing.",
  openGraph: { title: "Esthetician Booking Software | Pulse Appointments", description: "Online booking with intake forms and no-show protection for estheticians." },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Booking Software for Estheticians", item: "https://www.pulseappointments.com/for/estheticians" },
  ],
};

export default function EstheticiansPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
      title="Estheticians"
      headline="Booking software for Canadian estheticians"
      subheadline="Collect skin history before they arrive. Sell facial packages online. Stop chasing cancellations. Pulse handles it all — with Canadian privacy built in."
      heroEmoji="✨"
      features={[
        {
          icon: FileText,
          title: "Intake forms at booking",
          body: "Ask about skin type, current products, allergies, and medical conditions before the appointment. Clients fill it in when they book — you're prepared before they walk in.",
        },
        {
          icon: Package,
          title: "Sell facial packages online",
          body: "Offer 5-facial or 10-facial bundles. Clients pay upfront, credits are tracked per client, and the bundle shows as pre-paid at each booking.",
        },
        {
          icon: ShieldCheck,
          title: "PIPEDA-aware health data",
          body: "Skin conditions and treatment history are personal health information under PIPEDA. Pulse stores this data securely and gives clients the right to access and delete their records.",
        },
      ]}
      checklist={[
        "Online booking 24/7 — no phone tag",
        "Intake form with skin type, allergies, sensitivities",
        "Deposits for high-value treatments",
        "Facial packages and pre-paid credits",
        "Cancellation policy with late-cancel fee",
        "Automated 72h and 24h email reminders",
        "Post-visit follow-up and rebook reminders",
        "Gift cards for facials",
        "PIPEDA-compliant health information handling",
        "Client visit history and treatment notes",
        "Google review automation",
        "CAD invoices with HST",
      ]}
      testimonial={{
        quote: "The intake form alone saved me 15 minutes per appointment. Clients come prepared and I can focus on the treatment, not the consultation.",
        name: "Sophie R.",
        city: "Vancouver, BC",
      }}
    />
    </>
  );
}
