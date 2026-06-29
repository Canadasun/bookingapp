import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { ClipboardList, FileCheck2, ShieldCheck } from "lucide-react";
import { FeatureLandingPage } from "@/components/FeatureLandingPage";

export const metadata: Metadata = {
  title: "Client Intake Forms for Canadian Service Businesses | Pulse",
  description: "Collect allergies, preferences, consent details, and custom questions before clients arrive. Intake forms built into online booking.",
  alternates: buildAlternates("/features/intake-forms"),
  openGraph: {
    title: "Client Intake Forms | Pulse Appointments",
    description: "Collect client details and custom questions before each appointment.",
  },
};

const faqs = [
  {
    q: "Can I create custom intake questions?",
    a: "Yes. Pulse supports custom intake questions so businesses can collect the details that matter for their services.",
  },
  {
    q: "When do clients complete intake forms?",
    a: "Clients complete intake questions during the booking flow, before the appointment is confirmed.",
  },
  {
    q: "Are intake answers connected to the appointment?",
    a: "Yes. Intake answers are connected to the appointment and client context so staff can review them before the visit.",
  },
];

export default function IntakeFormsFeaturePage() {
  return (
    <FeatureLandingPage
      badge="Intake Forms"
      badgeIcon={ClipboardList}
      title="Collect client details before"
      titleAccent="they arrive"
      description="Ask the right questions at booking: allergies, preferences, goals, service notes, or consent details. Pulse keeps intake answers with the appointment so your team is prepared."
      slug="intake-forms"
      breadcrumbName="Intake Forms"
      proofPoints={["Custom questions", "Attached to bookings", "Canadian privacy pages"]}
      steps={[
        { num: "01", title: "Build your questions", desc: "Add custom fields for the service details, health notes, or preferences you need before the appointment." },
        { num: "02", title: "Client answers while booking", desc: "The intake step appears inside the booking flow, so details are collected before the visit." },
        { num: "03", title: "Staff review before service", desc: "Answers stay connected to the appointment and client record for faster, more prepared service." },
      ]}
      features={[
        { icon: ClipboardList, title: "Custom intake questions", body: "Collect the exact details your business needs instead of forcing a generic form." },
        { icon: FileCheck2, title: "Appointment context", body: "Answers stay tied to the booking, making pre-appointment review simple for staff." },
        { icon: ShieldCheck, title: "Trust documentation", body: "Pulse supports public privacy and security pages so clients understand how the booking experience is handled." },
      ]}
      comparisonTitle="Intake form comparison"
      competitors={["Calendly", "Acuity", "Vagaro", "Jane App"]}
      comparison={[
        { feature: "Custom booking questions", values: [true, true, true, true, true] },
        { feature: "Service-business intake flow", values: [true, false, true, true, true] },
        { feature: "Attached to client history", values: [true, false, true, true, true] },
        { feature: "Canadian privacy positioning", values: [true, false, false, false, true] },
        { feature: "CAD-first pricing", values: [true, false, false, false, true] },
      ]}
      faqs={faqs}
      ctaTitle="Collect better details before every appointment"
      ctaText="Start free and add intake questions to your booking flow without a separate form tool."
    />
  );
}
