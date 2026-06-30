import { buildAlternates } from "@/lib/hreflang";
import { PrivacyContent } from "@/components/legal/PrivacyContent";

export const metadata = {
  title: "Privacy Policy | Pulse Appointments",
  alternates: buildAlternates("/privacy"),
};

export default function PrivacyPage() {
  return <PrivacyContent locale="en" />;
}
