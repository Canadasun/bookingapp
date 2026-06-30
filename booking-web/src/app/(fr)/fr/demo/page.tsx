import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { DemoContent } from "@/components/marketing/DemoContent";

export const metadata: Metadata = {
  title: "Démo du produit : réservation en ligne, acomptes, rappels | Pulse Appointments",
  description: "Voyez comment Pulse Appointments gère la réservation en ligne, les acomptes, les rappels, les avis et le suivi des clients pour les entreprises de services canadiennes.",
  alternates: buildAlternates("/demo", "fr"),
  openGraph: {
    title: "Démo du produit Pulse Appointments",
    description: "Découvrez le parcours de réservation conçu pour les entreprises de services canadiennes.",
    url: "https://www.pulseappointments.com/fr/demo",
  },
};

export default function DemoPageFr() {
  return <DemoContent locale="fr" />;
}
