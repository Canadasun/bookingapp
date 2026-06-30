import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { AboutContent } from "@/components/marketing/AboutContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/about"),
  title: "About Pulse Appointments | Canadian Booking Software",
  description:
    "Learn about Pulse Appointments, a Canada-first online booking platform for salons, spas, barbers, wellness providers, and appointment-based service businesses.",
  openGraph: {
    title: "About Pulse Appointments",
    description:
      "Pulse is built for Canadian service businesses that need online booking, deposits, reminders, and no-show protection.",
  },
};

export default function AboutPage() {
  return <AboutContent locale="en" />;
}
