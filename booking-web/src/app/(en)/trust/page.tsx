import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { TrustContent } from "@/components/marketing/TrustContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/trust"),
  title: "Trust Center | Pulse Appointments",
  description:
    "Pulse Appointments trust center: security, Canadian privacy, verified businesses, real review collection, and product transparency.",
};

export default function TrustPage() {
  return <TrustContent locale="en" />;
}
