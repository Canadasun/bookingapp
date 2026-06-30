import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { TrustContent } from "@/components/marketing/TrustContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/trust", "fr"),
  title: "Centre de confiance | Pulse Appointments",
  description:
    "Centre de confiance Pulse Appointments : sécurité, vie privée au Canada, entreprises vérifiées, véritable collecte d’avis et transparence du produit.",
};

export default function TrustPageFr() {
  return <TrustContent locale="fr" />;
}
