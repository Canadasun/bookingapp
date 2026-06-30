import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { FaqContent } from "@/components/marketing/FaqContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/faq"),
  title: "FAQ | Pulse Appointments",
  description:
    "Frequently asked questions about Pulse Appointments — pricing, the free plan, Canadian data, deposits, no-show protection, migration, and bilingual support.",
  openGraph: {
    title: "Pulse Appointments FAQ",
    description:
      "Answers to common questions about Pulse Appointments: free plan, Canadian-first platform, deposits, reminders, and migrating from another tool.",
  },
};

export default function FaqPage() {
  return <FaqContent locale="en" />;
}
