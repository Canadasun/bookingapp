import type { Metadata } from "next";
import { History, MessageSquare, Search } from "lucide-react";
import { FeatureLandingPage } from "@/components/FeatureLandingPage";

export const metadata: Metadata = {
  title: "Client Management Software for Canadian Service Businesses | Pulse",
  description: "Keep client profiles, booking history, notes, messages, and appointment records in one place. Client management built for Canadian service businesses.",
  alternates: { canonical: "/features/client-management" },
  openGraph: {
    title: "Client Management Software | Pulse Appointments",
    description: "Client profiles, notes, messages, history, and booking records for Canadian service businesses.",
  },
};

const faqs = [
  {
    q: "What client details can I store in Pulse?",
    a: "Pulse stores client contact details, appointment history, notes, intake answers, messages, invoices, reviews, and booking preferences where available.",
  },
  {
    q: "Can staff see client notes?",
    a: "Owners and authorized staff can access client details from the dashboard so the team has context before each appointment.",
  },
  {
    q: "Is client management included on the free plan?",
    a: "Yes. The free plan includes client management basics. Paid plans add more operational tools such as reminders, deposits, no-show protection, and advanced team features.",
  },
];

export default function ClientManagementFeaturePage() {
  return (
    <FeatureLandingPage
      badge="Client Management"
      badgeIcon={Search}
      title="Keep every client detail"
      titleAccent="in one place"
      description="Stop digging through DMs, notes apps, and old calendars. Pulse keeps client profiles, appointment history, notes, and messages together so every visit starts with context."
      slug="client-management"
      breadcrumbName="Client Management"
      proofPoints={["Client history", "Private notes", "No credit card required"]}
      steps={[
        { num: "01", title: "Client books or gets added", desc: "Pulse creates a client profile when someone books online, or you can add one manually from the dashboard." },
        { num: "02", title: "History builds automatically", desc: "Appointments, services, invoices, reviews, and messages stay attached to the client record." },
        { num: "03", title: "Your team has context", desc: "Before the next appointment, staff can review notes and history instead of asking the same questions again." },
      ]}
      features={[
        { icon: History, title: "Appointment history", body: "See past and upcoming bookings, service details, and client activity without switching tools." },
        { icon: MessageSquare, title: "Client messages", body: "Keep appointment-related conversations connected to the business instead of scattered across personal inboxes." },
        { icon: Search, title: "Fast lookup", body: "Find clients quickly by name or contact details when they call, message, or walk in." },
      ]}
      comparisonTitle="Client management comparison"
      competitors={["Calendly", "Acuity", "Square", "Jane App"]}
      comparison={[
        { feature: "Client profiles", values: [true, false, true, true, true] },
        { feature: "Appointment history", values: [true, false, true, true, true] },
        { feature: "Client notes", values: [true, false, true, true, true] },
        { feature: "Built for services, not meetings", values: [true, false, true, "Partial", true] },
        { feature: "CAD-first pricing", values: [true, false, false, false, true] },
      ]}
      faqs={faqs}
      ctaTitle="Bring client context into every appointment"
      ctaText="Start free and keep your booking records, client details, and history connected from day one."
    />
  );
}
