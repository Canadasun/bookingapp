import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { Users, Package, Bell } from "lucide-react";

export const metadata: Metadata = {
  title: "Yoga Studio Scheduling Software | Pulse Appointments",
  description: "Yoga studio booking and class scheduling for Canadian yoga studios. Group classes, memberships, packages, waitlists, and automated reminders. CAD pricing.",
  openGraph: { title: "Yoga Studio Scheduling Software | Pulse Appointments", description: "Class scheduling, memberships, and no-show protection for Canadian yoga studios." },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Yoga Studio Scheduling Software", item: "https://www.pulseappointments.com/for/yoga-studios" },
  ],
};

export default function YogaStudiosPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
        title="Yoga Studios"
        headline="Class scheduling software for Canadian yoga studios"
        subheadline="Fill your classes, protect your time, and grow predictable revenue with memberships. Pulse handles group bookings, class capacity, and automated reminders — all in CAD."
        heroEmoji="🧘"
        features={[
          {
            icon: Users,
            title: "Group class scheduling",
            body: "Set a class capacity and let multiple students book the same slot. Each gets a confirmation. Pulse blocks the class once it's full — no overbooking.",
          },
          {
            icon: Package,
            title: "Memberships and class passes",
            body: "Offer monthly unlimited memberships billed by Stripe automatically. Or sell 5-, 10-, and 20-class passes. Credits are tracked per student and applied at each booking.",
          },
          {
            icon: Bell,
            title: "Automated class reminders",
            body: "Students get email and SMS reminders before every class. Fewer forgotten bookings means fuller classes and less last-minute scrambling.",
          },
        ]}
        checklist={[
          "Online class registration 24/7",
          "Group class capacity management — no overbooking",
          "Monthly memberships with automatic Stripe billing",
          "Class pass packages (5, 10, 20 classes)",
          "Automated 24h and 2h reminders before class",
          "Student intake forms (experience level, injuries)",
          "Cancellation policy with late-cancel fee",
          "Card-on-file for no-show fees",
          "Client portal for self-service booking management",
          "Google Calendar sync for instructors",
          "CAD pricing with GST/HST",
          "PIPEDA-aware health data handling",
        ]}
        testimonial={{
          quote: "Memberships on Pulse changed my studio's finances completely. I went from stressing about every week's revenue to having $5,000/month locked in before the month starts.",
          name: "Meera S.",
          city: "Ottawa, ON",
        }}
      />
    </>
  );
}
