import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { SupportContent } from "@/components/marketing/SupportContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/support", "fr"),
  title: "Soutien — Pulse",
  description: "Obtenez de l’aide avec Pulse Appointments. Écrivez-nous par courriel ou consultez les réponses aux questions fréquentes sur les réservations, la facturation et votre compte.",
  openGraph: {
    title: "Soutien — Pulse Appointments",
    description: "Obtenez de l’aide avec Pulse Appointments. Écrivez-nous par courriel ou consultez les réponses aux questions fréquentes.",
  },
  twitter: {
    card: "summary",
    title: "Soutien — Pulse Appointments",
    description: "Obtenez de l’aide avec Pulse Appointments.",
  },
};

export default function SupportPageFr() {
  return <SupportContent locale="fr" />;
}
