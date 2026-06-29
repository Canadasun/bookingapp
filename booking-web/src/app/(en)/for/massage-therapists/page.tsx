import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { ShieldCheck, Gift, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking Software for Massage Therapists | Pulse Appointments",
  description: "Massage therapy booking with intake forms, gift cards, deposits, and PIPEDA-aware health information handling. Canada-first, CAD pricing.",
  openGraph: { title: "Massage Therapy Booking Software | Pulse Appointments", description: "Online booking with health intake forms and no-show protection for massage therapists." },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Booking Software for Massage Therapists", item: "https://www.pulseappointments.com/for/massage-therapists" },
  ],
};

export default function MassageTherapistsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
      title="Massage Therapists"
      headline="Booking software for Canadian massage therapists"
      subheadline="A no-show on a 90-minute deep tissue slot costs you real money. Pulse protects that revenue with deposits — and handles health intake forms before clients arrive."
      heroEmoji="💆"
      features={[
        {
          icon: FileText,
          title: "Health intake forms",
          body: "Ask about health conditions, injuries, pressure preferences, and contraindications at booking. Clients fill it in before arrival. Stored securely and PIPEDA-compliant.",
        },
        {
          icon: ShieldCheck,
          title: "Deposit protection",
          body: "Require a deposit for 60- and 90-minute appointments. Pulse charges the card automatically on a no-show — you don't have to chase anyone.",
        },
        {
          icon: Gift,
          title: "Gift cards for holidays",
          body: "Sell massage gift cards online year-round. Clients send them as gifts. Recipients book and redeem online. Tracked and balanced automatically.",
        },
      ]}
      checklist={[
        "Online booking 24/7 with no phone tag",
        "Health intake form (injuries, conditions, preferences)",
        "Deposits for long appointments",
        "Card-on-file for no-show fees",
        "Cancellation policy enforcement",
        "Automated 72h and 24h email reminders",
        "2h SMS reminder for same-day appointments",
        "Gift cards (holiday, birthday, corporate)",
        "Rebooking reminders based on treatment cadence",
        "PIPEDA-aware health information storage",
        "Client visit history and treatment notes",
        "CAD invoices with HST for receipts",
      ]}
    />
    </>
  );
}
