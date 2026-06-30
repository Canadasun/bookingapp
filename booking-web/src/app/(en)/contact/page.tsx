import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { ContactContent } from "@/components/marketing/ContactContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/contact"),
  title: "Contact Pulse Appointments | Sales & Support",
  description:
    "Get in touch with Pulse Appointments. Reach sales for pre-signup questions, customer support for booking help, or merchant escalation for urgent business issues.",
  openGraph: {
    title: "Contact Pulse Appointments",
    description:
      "Reach Pulse sales, customer support, or merchant escalation — we typically respond within one business day.",
  },
};

export default function ContactPage() {
  return <ContactContent locale="en" />;
}
