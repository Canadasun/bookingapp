import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { ContactContent } from "@/components/marketing/ContactContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/contact", "fr"),
  title: "Joindre Pulse Appointments | Ventes et soutien",
  description:
    "Communiquez avec Pulse Appointments. Joignez les ventes pour vos questions avant l’inscription, le soutien à la clientèle pour l’aide à la réservation, ou l’escalade marchand pour les problèmes urgents.",
  openGraph: {
    title: "Joindre Pulse Appointments",
    description:
      "Joignez les ventes, le soutien à la clientèle ou l’escalade marchand de Pulse — nous répondons généralement dans un délai d’un jour ouvrable.",
  },
};

export default function ContactPageFr() {
  return <ContactContent locale="fr" />;
}
