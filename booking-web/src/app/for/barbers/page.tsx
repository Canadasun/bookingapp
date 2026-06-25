import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { Scissors, Star, Bell } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking Software for Canadian Barbers | Pulse Appointments",
  description: "Barber shop booking with online deposits, no-show protection, SMS reminders, and Google review automation. Canada-first, CAD pricing.",
  openGraph: { title: "Barber Shop Booking Software | Pulse Appointments", description: "No-show protection and automated reminders for Canadian barbers." },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Booking Software for Barbers", item: "https://www.pulseappointments.com/for/barbers" },
  ],
};

export default function BarbersPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
      title="Barbers"
      headline="The booking platform Canadian barbers actually use"
      subheadline="Fill every chair, protect every cut. Pulse automates reminders, deposits, and rebooking so you can focus on the craft."
      heroEmoji="✂️"
      features={[
        {
          icon: Bell,
          title: "SMS reminders that work",
          body: "Send automated text reminders 24 hours and 2 hours before every cut. Clients who get reminders show up — it's that simple.",
        },
        {
          icon: Scissors,
          title: "Fast rebook from the dashboard",
          body: "One click to rebook a client from their last appointment. Set intervals — a client who books every 3 weeks gets a rebooking reminder automatically.",
        },
        {
          icon: Star,
          title: "Google review automation",
          body: "After every appointment, Pulse sends a review request email. More 5-star reviews means more clients finding you on Google Maps.",
        },
      ]}
      checklist={[
        "Online booking 24/7 from any device",
        "Deposits to protect against no-shows",
        "SMS text reminders (24h and 2h before)",
        "Automated rebooking reminders",
        "Google review request emails",
        "Client notes and visit history",
        "Multiple staff with individual booking links",
        "Cancellation fee enforcement",
        "Booking approval or auto-confirm",
        "Card-on-file for no-show fees",
        "CAD pricing with HST/GST fields",
        "Google Calendar sync",
      ]}
    />
    </>
  );
}
