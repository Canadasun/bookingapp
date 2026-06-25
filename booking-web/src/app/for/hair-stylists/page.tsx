import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { ShieldCheck, Bell, RefreshCw } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking Software for Hair Stylists | Pulse Appointments",
  description: "Online booking for independent hair stylists in Canada. Deposits, no-show protection, colour service protection, and automated reminders. CAD pricing.",
  openGraph: { title: "Hair Stylist Booking Software | Pulse Appointments", description: "No-show protection and colour service deposits for Canadian hair stylists." },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Booking Software for Hair Stylists", item: "https://www.pulseappointments.com/for/hair-stylists" },
  ],
};

export default function HairStylistsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
        title="Hair Stylists"
        headline="Booking software for independent Canadian hair stylists"
        subheadline="Colour appointments blocked by a no-show cost you hours and product. Pulse requires a deposit at booking — and charges the card automatically if they don't show."
        heroEmoji="💇‍♀️"
        features={[
          {
            icon: ShieldCheck,
            title: "Colour service deposit protection",
            body: "Require a deposit sized to your colour costs. A no-show on a full-highlight is $150+ in lost time and product. Pulse charges the card automatically — no awkward conversations.",
          },
          {
            icon: Bell,
            title: "Automated reminders that reduce no-shows",
            body: "Send email and SMS reminders 72h, 24h, and 2h before every appointment. Clients who get reminders show up. It's the simplest thing you can do to protect your schedule.",
          },
          {
            icon: RefreshCw,
            title: "Rebooking reminders",
            body: "Pulse automatically reminds clients when they're due for their next cut or colour based on the interval you set. Turns a walk-in into a loyal regular.",
          },
        ]}
        checklist={[
          "Online booking 24/7 from Instagram, Google, or your website",
          "Deposits for colour services and long appointments",
          "No-show fee auto-charge to card-on-file",
          "Automated 72h, 24h, and 2h reminders",
          "Rebooking reminders at the right interval",
          "Client profiles with visit history and colour notes",
          "Multiple staff with individual booking links",
          "Gift cards for birthdays and holidays",
          "Google review automation after each appointment",
          "Booking page for your Instagram bio link",
          "CAD pricing with HST/GST on invoices",
          "Google Calendar two-way sync",
        ]}
      />
    </>
  );
}
