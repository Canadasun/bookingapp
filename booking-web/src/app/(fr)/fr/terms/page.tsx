import { buildAlternates } from "@/lib/hreflang";
import { TermsContent } from "@/components/legal/TermsContent";

export const metadata = {
  alternates: buildAlternates("/terms", "fr"), title: "Conditions d’utilisation | Pulse Appointments" };

export default function TermsPageFr() {
  return <TermsContent locale="fr" />;
}
