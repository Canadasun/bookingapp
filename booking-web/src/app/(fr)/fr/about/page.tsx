import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { AboutContent } from "@/components/marketing/AboutContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/about", "fr"),
  title: "À propos de Pulse Appointments | Logiciel de réservation canadien",
  description:
    "Découvrez Pulse Appointments, une plateforme de réservation en ligne d’abord canadienne pour les salons, spas, barbiers, prestataires de mieux-être et entreprises de services sur rendez-vous.",
  openGraph: {
    title: "À propos de Pulse Appointments",
    description:
      "Pulse est conçu pour les entreprises de services canadiennes qui ont besoin de réservation en ligne, d’acomptes, de rappels et de protection contre les absences.",
  },
};

export default function AboutPageFr() {
  return <AboutContent locale="fr" />;
}
