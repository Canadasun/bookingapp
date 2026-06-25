import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { Users, ShieldCheck, BarChart3 } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking Software for Canadian Salons | Pulse Appointments",
  description: "The #1 Canada-first booking platform for hair salons. Online deposits, no-show protection, multi-staff calendar, and automated reminders. CAD pricing.",
  openGraph: { title: "Booking Software for Canadian Salons | Pulse Appointments", description: "Salon booking with deposits, no-show protection, and SMS reminders. CAD pricing." },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Booking Software for Salons", item: "https://www.pulseappointments.com/for/salons" },
  ],
};

export default function SalonsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
      title="Salons"
      headline="Booking software built for Canadian salons"
      subheadline="Stop losing money to last-minute cancellations. Pulse lets you require a deposit when clients book — and charges the card automatically if they no-show."
      heroEmoji="💇"
      features={[
        {
          icon: ShieldCheck,
          title: "No-show protection",
          body: "Require a deposit at booking. If they no-show, charge the card automatically. See exactly how much money Pulse saved you in your Revenue Protected dashboard.",
        },
        {
          icon: Users,
          title: "Multi-staff calendar",
          body: "Manage your whole team in one place. Clients choose their stylist. You see everyone's schedule side-by-side with zero double-bookings.",
        },
        {
          icon: BarChart3,
          title: "Staff performance reports",
          body: "See revenue by stylist, repeat client rate, and top services. Know who's driving your business — and reward them for it.",
        },
      ]}
      checklist={[
        "Online booking 24/7 — no app download required",
        "Deposits and card-on-file for colour services",
        "Automated email + SMS reminders (72h, 24h, 2h)",
        "Multi-staff calendar with individual schedules",
        "Client profiles with visit history and notes",
        "Google Calendar two-way sync",
        "Gift cards and packages",
        "Automated Google review requests",
        "GST/HST tax fields on invoices",
        "CASL-compliant marketing consent",
        "CAD pricing — no USD surprises",
        "Mobile app for you and your staff",
      ]}
      testimonial={{
        quote: "We reduced no-shows by 80% in the first month by turning on deposits. Pulse paid for itself in week one.",
        name: "Alicia T.",
        city: "Ottawa, ON",
      }}
    />
    </>
  );
}
