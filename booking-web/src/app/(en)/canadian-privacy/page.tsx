import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { CanadianPrivacyContent } from "@/components/legal/CanadianPrivacyContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/canadian-privacy"),
  title: "Canadian Privacy | Pulse Appointments",
  description: "How Pulse Appointments complies with PIPEDA, Alberta PIPA, and CASL. Data residency, consent, and health information practices for Canadian businesses.",
  openGraph: { title: "Canadian Privacy | Pulse Appointments", description: "PIPEDA, PIPA, and CASL compliance for Canadian service businesses." },
};

export default function CanadianPrivacyPage() {
  return <CanadianPrivacyContent locale="en" />;
}
