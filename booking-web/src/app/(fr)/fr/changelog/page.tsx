import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { ChangelogContent } from "@/components/marketing/ChangelogContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/changelog", "fr"),
  title: "Nouveautés | Pulse Appointments",
  description: "Quoi de neuf dans Pulse Appointments. Lancements de fonctionnalités, améliorations et correctifs récents.",
  openGraph: { title: "Nouveautés | Pulse Appointments", description: "Nouvelles fonctionnalités et mises à jour de Pulse Appointments." },
};

export default function ChangelogPageFr() {
  return <ChangelogContent locale="fr" />;
}
