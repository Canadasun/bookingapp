import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { Building2, CalendarDays, MapPin } from "lucide-react";
import { FeatureLandingPage } from "@/components/FeatureLandingPage";

export const metadata: Metadata = {
  title: "Multi-Location Booking Software for Canadian Service Businesses | Pulse",
  description: "Manage multiple locations, staff calendars, service availability, and online booking links in Pulse. Built for Canadian service businesses.",
  alternates: buildAlternates("/features/multi-location"),
  openGraph: {
    title: "Multi-Location Booking Software | Pulse Appointments",
    description: "Manage service booking across multiple business locations and staff calendars.",
  },
};

const faqs = [
  {
    q: "How many locations can I manage in Pulse?",
    a: "Pulse supports multiple locations on paid plans. Pro supports 2 locations and Unlimited supports up to 5.",
  },
  {
    q: "Can each location have different staff and availability?",
    a: "Yes. Locations can be managed with their own operational context, staff schedules, and booking setup.",
  },
  {
    q: "Is multi-location useful for mobile service providers?",
    a: "Yes. Location support helps businesses separate service areas, studios, pop-ups, or different operating addresses.",
  },
];

export default function MultiLocationFeaturePage() {
  return (
    <FeatureLandingPage
      badge="Multi-Location"
      badgeIcon={MapPin}
      title="Run booking across multiple"
      titleAccent="locations"
      description="Whether you have two studios, rotating pop-ups, or multiple service areas, Pulse helps keep locations, staff, calendars, and client booking paths organized."
      slug="multi-location"
      breadcrumbName="Multi-Location"
      proofPoints={["Pro supports 2 locations", "Unlimited supports up to 5", "Staff calendars"]}
      steps={[
        { num: "01", title: "Add your locations", desc: "Create each studio, service area, or operating address in your business settings." },
        { num: "02", title: "Assign services and staff", desc: "Keep staff schedules and service availability aligned with where the work actually happens." },
        { num: "03", title: "Clients book the right place", desc: "Clients see the right location context while your team keeps calendars organized behind the scenes." },
      ]}
      features={[
        { icon: Building2, title: "Location management", body: "Keep multiple studios, rooms, pop-ups, or service areas organized under one Pulse account." },
        { icon: CalendarDays, title: "Calendar clarity", body: "Reduce scheduling mistakes by separating where appointments happen from who provides them." },
        { icon: MapPin, title: "Local expansion ready", body: "Built for Canadian businesses growing from solo operator to team and multi-location operations." },
      ]}
      comparisonTitle="Multi-location comparison"
      competitors={["Calendly", "Acuity", "Square", "Vagaro"]}
      comparison={[
        { feature: "Multiple business locations", values: [true, false, true, true, true] },
        { feature: "Staff calendars", values: [true, true, true, true, true] },
        { feature: "Service-business booking flow", values: [true, false, true, true, true] },
        { feature: "CAD-first pricing", values: [true, false, false, false, false] },
        { feature: "Flat plan structure", values: [true, false, false, "Partial", false] },
      ]}
      faqs={faqs}
      ctaTitle="Keep every location organized"
      ctaText="Start free, then upgrade when your business needs multi-location booking controls."
    />
  );
}
