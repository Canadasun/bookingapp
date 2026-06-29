import type { Metadata } from "next";
import { Eye, Send, Star } from "lucide-react";
import { FeatureLandingPage } from "@/components/FeatureLandingPage";

export const metadata: Metadata = {
  title: "Review Management Software for Canadian Service Businesses | Pulse",
  description: "Collect and publish real appointment reviews from completed visits. Review management for Canadian service businesses using Pulse.",
  alternates: { canonical: "/features/reviews" },
  openGraph: {
    title: "Review Management Software | Pulse Appointments",
    description: "Collect, moderate, and publish reviews tied to real appointments.",
  },
};

const faqs = [
  {
    q: "Does Pulse create reviews automatically?",
    a: "No. Pulse sends review requests after completed appointments, but clients choose whether to leave feedback.",
  },
  {
    q: "Can I choose which reviews are public?",
    a: "Yes. Owners can publish or hide reviews from the dashboard before they appear publicly.",
  },
  {
    q: "Where do published reviews appear?",
    a: "Published reviews can appear on the public booking page so prospective clients can evaluate the business before booking.",
  },
];

export default function ReviewsFeaturePage() {
  return (
    <FeatureLandingPage
      badge="Review Management"
      badgeIcon={Star}
      title="Collect real reviews after"
      titleAccent="completed visits"
      description="Pulse helps you earn trust the right way: send review requests after real appointments, moderate feedback, and publish reviews where new clients are deciding whether to book."
      slug="reviews"
      breadcrumbName="Review Management"
      proofPoints={["Real appointment requests", "Owner moderation", "No fake testimonials"]}
      steps={[
        { num: "01", title: "Appointment is completed", desc: "Review requests are connected to actual appointment activity, not invented marketing copy." },
        { num: "02", title: "Client leaves feedback", desc: "Clients can rate the experience and add a written comment from a signed review link." },
        { num: "03", title: "You publish what is useful", desc: "Owners can publish or hide reviews from the dashboard before they appear publicly." },
      ]}
      features={[
        { icon: Send, title: "Review request workflow", body: "Turn completed appointments into timely review requests without manual follow-up." },
        { icon: Eye, title: "Moderation controls", body: "Review feedback privately and choose what appears publicly on your booking page." },
        { icon: Star, title: "Public trust signal", body: "Published reviews help new clients make a booking decision without relying on placeholder testimonials." },
      ]}
      comparisonTitle="Review management comparison"
      competitors={["Calendly", "Acuity", "Square", "Vagaro"]}
      comparison={[
        { feature: "Appointment-based review requests", values: [true, false, false, "Partial", true] },
        { feature: "Public booking-page reviews", values: [true, false, false, true, true] },
        { feature: "Owner moderation", values: [true, false, false, true, true] },
        { feature: "Built for services, not meetings", values: [true, false, true, "Partial", true] },
        { feature: "CAD-first pricing", values: [true, false, false, false, false] },
      ]}
      faqs={faqs}
      ctaTitle="Start collecting real review proof"
      ctaText="Use completed appointments to build public trust without publishing fabricated testimonials."
    />
  );
}
