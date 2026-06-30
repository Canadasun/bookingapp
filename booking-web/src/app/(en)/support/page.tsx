import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { SupportContent } from "@/components/marketing/SupportContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/support"),
  title: "Support — Pulse",
  description: "Get help with Pulse Appointments. Contact us by email or browse answers to common questions about bookings, billing, and your account.",
  openGraph: {
    title: "Support — Pulse Appointments",
    description: "Get help with Pulse Appointments. Contact us by email or browse answers to common questions.",
  },
  twitter: {
    card: "summary",
    title: "Support — Pulse Appointments",
    description: "Get help with Pulse Appointments.",
  },
};

export default function SupportPage() {
  return <SupportContent locale="en" />;
}
