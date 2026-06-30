import type { Metadata } from "next";
import { QuebecComplianceContent } from "@/components/legal/QuebecComplianceContent";
import { buildAlternates } from "@/lib/hreflang";

export const metadata: Metadata = {
  title: "Préparation à la Loi 25 et aux exigences linguistiques",
  description: "Comment les fonctions bilingues et de confidentialité de Pulse peuvent soutenir la démarche des entreprises québécoises.",
  alternates: buildAlternates("/quebec-compliance", "fr"),
};

export default function QuebecCompliancePageFr() {
  return <QuebecComplianceContent locale="fr" />;
}
