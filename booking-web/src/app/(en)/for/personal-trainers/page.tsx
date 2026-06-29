import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { CalendarCheck2, Dumbbell, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Personal Trainer Scheduling App Canada | Pulse Appointments",
  description: "Scheduling software for Canadian personal trainers. Online booking, recurring session management, deposits, SMS reminders, and CAD pricing.",
  openGraph: {
    title: "Personal Trainer Scheduling App Canada | Pulse Appointments",
    description: "Online booking with deposits, reminders, and recurring client workflows for Canadian personal trainers.",
  },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Booking Software for Personal Trainers", item: "https://www.pulseappointments.com/for/personal-trainers" },
  ],
};

export default function PersonalTrainersPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
        title="Personal Trainers"
        headline="Scheduling software for Canadian personal trainers"
        subheadline="Book sessions online, protect high-value time blocks with deposits, and keep clients coming back with reminders and package-friendly workflows."
        heroEmoji="🏋️"
        features={[
          {
            icon: CalendarCheck2,
            title: "Session scheduling",
            body: "Let clients book consults, assessments, one-on-one sessions, and recurring training times without back-and-forth texts.",
          },
          {
            icon: ShieldCheck,
            title: "Deposit protection",
            body: "Require deposits or keep cards on file for long training blocks so late cancellations do not wipe out your day.",
          },
          {
            icon: Dumbbell,
            title: "Client retention",
            body: "Use reminders, client history, packages, and follow-up workflows to keep training momentum visible between sessions.",
          },
        ]}
        checklist={[
          "Online booking for assessments and training sessions",
          "Deposits and card-on-file for no-show protection",
          "SMS and email reminders before each session",
          "Client profiles with goals, notes, and visit history",
          "Packages for multi-session training plans",
          "Manual approval for new client consults",
          "Google Calendar two-way sync",
          "Mobile-friendly booking page",
          "Review requests after completed appointments",
          "CAD pricing — no USD conversion surprises",
          "PIPEDA-aware client data handling",
          "Works for studio, mobile, and virtual trainers",
        ]}
      />
    </>
  );
}
