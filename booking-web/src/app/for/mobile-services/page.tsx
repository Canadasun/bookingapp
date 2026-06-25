import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { MapPin, ShieldCheck, Bell } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking Software for Mobile Service Providers | Pulse Appointments",
  description: "Mobile service booking with location intake, travel buffer time, deposits, and GPS-aware scheduling. Canada-first, CAD pricing.",
  openGraph: { title: "Mobile Service Booking Software | Pulse Appointments", description: "Booking with location and travel buffer for Canadian mobile service providers." },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Booking Software for Mobile Services", item: "https://www.pulseappointments.com/for/mobile-services" },
  ],
};

export default function MobileServicesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
      title="Mobile Services"
      headline="Online booking for mobile service professionals"
      subheadline="You go to them. Pulse handles the scheduling. Collect client addresses at booking, build in travel time, and require a deposit so your drive is never wasted."
      heroEmoji="🚐"
      features={[
        {
          icon: MapPin,
          title: "Collect client address at booking",
          body: "Add a custom intake question asking for the service address. No surprise destinations — you know where you're going before you leave.",
        },
        {
          icon: Bell,
          title: "Buffer time between appointments",
          body: "Set a travel buffer of 15, 30, or 60 minutes after each service. Pulse blocks that time so you're never double-booked while driving between clients.",
        },
        {
          icon: ShieldCheck,
          title: "Deposit — protect the drive",
          body: "If a client no-shows when you've driven 30 minutes to their location, that's money and time you don't get back. Pulse requires a deposit to protect every call.",
        },
      ]}
      checklist={[
        "Online booking 24/7 from any device",
        "Custom intake form with address field",
        "Buffer time between appointments for travel",
        "Deposits to protect mobile calls",
        "No-show fee auto-charge",
        "Cancellation policy with late-cancel fee",
        "Automated 24h and 2h reminders with address confirmation",
        "Service area notes in confirmation email",
        "Client portal for self-service booking management",
        "Google Calendar sync to track your day",
        "CAD invoices with HST for clients",
        "Mobile app to manage bookings on the go",
      ]}
    />
    </>
  );
}
