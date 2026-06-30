import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { FaqContent } from "@/components/marketing/FaqContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/faq", "fr"),
  title: "FAQ | Pulse Appointments",
  description:
    "Foire aux questions sur Pulse Appointments — tarifs, forfait gratuit, données canadiennes, acomptes, protection contre les absences, migration et soutien bilingue.",
  openGraph: {
    title: "FAQ de Pulse Appointments",
    description:
      "Réponses aux questions fréquentes sur Pulse Appointments : forfait gratuit, plateforme d’abord canadienne, acomptes, rappels et migration depuis un autre outil.",
  },
};

export default function FaqPageFr() {
  return <FaqContent locale="fr" />;
}
