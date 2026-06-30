import type { Metadata } from "next";
import { QuebecComplianceContent } from "@/components/legal/QuebecComplianceContent";
import { buildAlternates } from "@/lib/hreflang";

export const metadata: Metadata = {
  title: "Quebec Privacy and French-Language Readiness",
  description: "How Pulse’s bilingual booking and privacy capabilities can support Quebec businesses working through Law 25 and French-language requirements.",
  alternates: buildAlternates("/quebec-compliance", "en"),
};

export default function QuebecCompliancePage() {
  return <QuebecComplianceContent locale="en" />;
}
