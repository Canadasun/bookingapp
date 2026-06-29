import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { IndustryPage } from "@/components/IndustryPage";
import { Users, Gift, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  alternates: buildAlternates("/for/spas"),
  title: "Spa Management Software for Canadian Spas | Pulse Appointments",
  description: "Spa booking and management software for Canadian day spas. Online booking, deposits, multi-staff scheduling, packages, gift cards, and no-show protection. CAD pricing.",
  openGraph: { title: "Spa Management Software | Pulse Appointments", description: "Online booking, deposits, and no-show protection for Canadian spas." },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Spa Management Software", item: "https://www.pulseappointments.com/for/spas" },
  ],
};

export default function SpasPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
        title="Spas"
        headline="Spa management software built for Canadian day spas"
        subheadline="Manage your whole team in one place. Protect high-value treatments with deposits. Sell packages and gift cards online. Pulse has everything a Canadian spa needs."
        heroEmoji="🧖"
        features={[
          {
            icon: Users,
            title: "Multi-therapist scheduling",
            body: "Every therapist has their own calendar and service menu. Clients choose their provider. You see the whole team's schedule side-by-side with zero double-bookings.",
          },
          {
            icon: Gift,
            title: "Gift cards and packages",
            body: "Sell spa day packages and gift cards online year-round. A $200 spa package bought online is revenue in your account before the client walks in the door.",
          },
          {
            icon: ShieldCheck,
            title: "Deposit protection for premium treatments",
            body: "Require a deposit for massage, facial, and body treatment bookings. Card is charged automatically for no-shows and late cancellations — you never have to chase anyone.",
          },
        ]}
        checklist={[
          "Online booking 24/7 — no phone tag for appointments",
          "Multi-therapist calendar with room scheduling",
          "Deposits for massages, facials, and body treatments",
          "No-show fee auto-charge to card-on-file",
          "Spa packages and pre-paid treatment bundles",
          "Gift cards (holiday, birthday, corporate wellness)",
          "Health intake forms (allergies, sensitivities, conditions)",
          "Automated 72h, 24h, and 2h reminders",
          "PIPEDA-compliant health information handling",
          "Client profiles with visit and treatment history",
          "GST/HST on all invoices",
          "CAD pricing — no USD conversion surprises",
        ]}
      />
    </>
  );
}
