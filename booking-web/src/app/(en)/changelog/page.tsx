import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { ChangelogContent } from "@/components/marketing/ChangelogContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/changelog"),
  title: "Changelog | Pulse Appointments",
  description: "What's new in Pulse Appointments. Recent feature releases, improvements, and fixes.",
  openGraph: { title: "Changelog | Pulse Appointments", description: "New features and updates for Pulse Appointments." },
};

export default function ChangelogPage() {
  return <ChangelogContent locale="en" />;
}
