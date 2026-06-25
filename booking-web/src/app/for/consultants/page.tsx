import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { Video, Calendar, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking Software for Consultants | Pulse Appointments",
  description: "Consultant booking with virtual meeting links, Google Calendar sync, booking approval, and deposit protection. Canada-first, CAD pricing.",
  openGraph: { title: "Consultant Booking Software | Pulse Appointments", description: "Online booking with calendar sync and no-show protection for Canadian consultants." },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Booking Software for Consultants", item: "https://www.pulseappointments.com/for/consultants" },
  ],
};

export default function ConsultantsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
      title="Consultants"
      headline="Stop losing billable hours to no-shows"
      subheadline="Pulse lets clients book consultation slots online — while you stay in control. Require a deposit, approve bookings manually, and sync to your calendar automatically."
      heroEmoji="💼"
      features={[
        {
          icon: ShieldCheck,
          title: "Deposit for consultations",
          body: "Require a deposit equal to your hourly rate. Serious clients pay it. Time-wasters don't book. Your calendar fills with quality appointments.",
        },
        {
          icon: Calendar,
          title: "Google Calendar sync",
          body: "Every booked consultation appears in your Google Calendar automatically. Your personal calendar's busy blocks appear as unavailable to new bookers.",
        },
        {
          icon: Video,
          title: "Booking approval mode",
          body: "Turn on manual approval so you review and confirm every booking before it's confirmed. Perfect for high-value engagements where client fit matters.",
        },
      ]}
      checklist={[
        "Online booking page you can link from LinkedIn and email",
        "Deposits for consultation sessions",
        "Manual booking approval mode",
        "Google Calendar two-way sync",
        "Add custom intake questions (budget, project type, timeline)",
        "Automated confirmation and reminder emails",
        "Invoice generation with your tax number",
        "GST/HST on invoices",
        "Cancellation policy with late-cancel fee",
        "Client portal for self-service booking management",
        "CAD pricing — no currency conversion",
        "PIPEDA-compliant data handling",
      ]}
      testimonial={{
        quote: "I set up Pulse in an afternoon. Now my discovery call calendar manages itself. I focus on the work, not on booking coordination.",
        name: "James H.",
        city: "Edmonton, AB",
      }}
    />
    </>
  );
}
