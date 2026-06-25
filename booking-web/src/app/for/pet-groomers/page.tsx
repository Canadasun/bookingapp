import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { PawPrint, Bell, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking Software for Pet Groomers | Pulse Appointments",
  description: "Pet grooming booking with breed notes, client intake forms, deposits, and SMS reminders. Canada-first, CAD pricing.",
  openGraph: { title: "Pet Grooming Booking Software | Pulse Appointments", description: "Online booking with pet-specific intake forms and no-show protection for groomers." },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Booking Software for Pet Groomers", item: "https://www.pulseappointments.com/for/pet-groomers" },
  ],
};

export default function PetGroomersPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
      title="Pet Groomers"
      headline="Booking software built for Canadian pet groomers"
      subheadline="Get breed, size, coat type, and behavioural notes before every appointment. Protect against last-minute cancellations with deposits. Done."
      heroEmoji="🐾"
      features={[
        {
          icon: PawPrint,
          title: "Breed and pet intake notes",
          body: "Capture breed, size, coat type, matting level, and behaviour notes using the intake form at booking. Know the dog before they walk in the door.",
        },
        {
          icon: ShieldCheck,
          title: "Deposits to stop flakes",
          body: "Pet grooming slots are hard to fill last-minute. Require a deposit when clients book and charge it automatically for no-shows. Stop absorbing the cost of other people's bad habits.",
        },
        {
          icon: Bell,
          title: "Pickup reminders",
          body: "Send an automated SMS when the groom is done. Clients know when to come pick up. No more dogs waiting, no more front-desk calls.",
        },
      ]}
      checklist={[
        "Online booking 24/7 from any device",
        "Pet intake form (breed, size, coat, behaviour, vaccines)",
        "Multiple pets per client via client notes and tags",
        "Deposits to protect grooming slots",
        "Card-on-file for no-show fees",
        "Cancellation policy with late-cancel fee",
        "Automated appointment reminders via email and SMS",
        "Custom pickup notification messaging",
        "Rebooking reminders at the right interval (4-8 weeks)",
        "Google review requests after each groom",
        "Client notes and history per visit",
        "CAD pricing with GST/HST on invoices",
      ]}
    />
    </>
  );
}
