import type { Metadata } from "next";
import { IndustryPage } from "@/components/IndustryPage";
import { Users, Package, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Booking Software for Wellness Providers | Pulse Appointments",
  description: "Wellness booking with memberships, packages, group classes, deposits, and no-show protection. Canada-first, CAD pricing.",
  openGraph: { title: "Wellness Booking Software | Pulse Appointments", description: "Memberships, packages, and no-show protection for Canadian wellness providers." },
};

export default function WellnessPage() {
  return (
    <IndustryPage
      title="Wellness"
      headline="Booking software for Canadian wellness professionals"
      subheadline="Run memberships, sell packages, and protect appointments with deposits. Pulse gives you the tools to grow predictable, recurring wellness revenue."
      heroEmoji="🧘"
      features={[
        {
          icon: Package,
          title: "Wellness memberships",
          body: "Offer monthly memberships with included sessions. Stripe bills automatically each month. Members track their usage in the client portal.",
        },
        {
          icon: Users,
          title: "Group classes (up to capacity)",
          body: "Mark a service as a group session and set a capacity. Multiple clients book the same slot up to capacity. Each gets their own confirmation.",
        },
        {
          icon: ShieldCheck,
          title: "No-show protection",
          body: "Require a deposit or card-on-file for all appointments. Late cancellations and no-shows are charged automatically — no awkward conversations.",
        },
      ]}
      checklist={[
        "Online booking for 1-on-1 and group sessions",
        "Monthly memberships with Stripe billing",
        "Pre-paid session packages",
        "Deposits and card-on-file",
        "No-show fee auto-charge",
        "Automated email and SMS reminders",
        "Client intake forms (health goals, conditions)",
        "Rebooking reminders after each session",
        "Birthday and win-back campaigns",
        "Google review automation",
        "CAD pricing with GST/HST",
        "PIPEDA-aware health data handling",
      ]}
      testimonial={{
        quote: "Memberships changed my business. I went from unpredictable weekly revenue to $4,000/month baseline — with bookings that fill themselves.",
        name: "Amara B.",
        city: "Halifax, NS",
      }}
    />
  );
}
