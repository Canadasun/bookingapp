import { buildAlternates } from "@/lib/hreflang";
import { TermsContent } from "@/components/legal/TermsContent";

export const metadata = {
  alternates: buildAlternates("/terms"), title: "Terms of Service | Pulse Appointments" };

export default function TermsPage() {
  return <TermsContent locale="en" />;
}
