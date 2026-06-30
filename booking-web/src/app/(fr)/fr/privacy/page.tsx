import { buildAlternates } from "@/lib/hreflang";
import { PrivacyContent } from "@/components/legal/PrivacyContent";

export const metadata = {
  title: "Politique de confidentialité | Pulse Appointments",
  alternates: buildAlternates("/privacy", "fr"),
};

export default function PrivacyPageFr() {
  return <PrivacyContent locale="fr" />;
}
