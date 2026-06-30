import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { AccessibilityContent } from "@/components/marketing/AccessibilityContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/accessibility"),
  title: "Accessibility Statement — Pulse",
  description: "Pulse Appointments is committed to WCAG 2.2 AA accessibility. Learn about our standards, known limitations, and how to report an issue.",
  openGraph: {
    title: "Accessibility Statement — Pulse Appointments",
    description: "Pulse Appointments is committed to WCAG 2.2 AA accessibility.",
  },
  twitter: {
    card: "summary",
    title: "Accessibility Statement — Pulse Appointments",
    description: "Pulse Appointments is committed to WCAG 2.2 AA accessibility.",
  },
};

export default function AccessibilityPage() {
  return <AccessibilityContent locale="en" />;
}
