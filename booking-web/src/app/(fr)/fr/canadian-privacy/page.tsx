import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { CanadianPrivacyContent } from "@/components/legal/CanadianPrivacyContent";

export const metadata: Metadata = {
  alternates: buildAlternates("/canadian-privacy", "fr"),
  title: "Vie privée au Canada | Pulse Appointments",
  description: "Comment Pulse Appointments se conforme à la LPRPDE, à la PIPA de l’Alberta et à la LCAP. Résidence des données, consentement et renseignements sur la santé pour les entreprises canadiennes.",
  openGraph: { title: "Vie privée au Canada | Pulse Appointments", description: "Conformité à la LPRPDE, à la PIPA et à la LCAP pour les entreprises de services canadiennes." },
};

export default function CanadianPrivacyPageFr() {
  return <CanadianPrivacyContent locale="fr" />;
}
