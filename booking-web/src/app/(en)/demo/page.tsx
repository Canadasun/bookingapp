import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { DemoContent } from "@/components/marketing/DemoContent";

export const metadata: Metadata = {
  title: "Product Demo: Online Booking, Deposits, Reminders | Pulse Appointments",
  description: "See how Pulse Appointments handles online booking, deposits, reminders, reviews, and client follow-up for Canadian service businesses.",
  alternates: buildAlternates("/demo"),
  openGraph: {
    title: "Pulse Appointments Product Demo",
    description: "Tour the booking flow built for Canadian service businesses.",
    url: "https://www.pulseappointments.com/demo",
  },
};

export default function DemoPage() {
  return <DemoContent locale="en" />;
}
