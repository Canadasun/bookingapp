import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { ReferralsContent } from "@/components/marketing/ReferralsContent";

export const metadata: Metadata = {
  title: "Programme de parrainage pour les entreprises de services canadiennes | Pulse Appointments",
  description: "Partagez Pulse avec une autre entreprise de services canadienne. Les codes de parrainage sont intégrés à l’inscription et à la facturation pour que les récompenses admissibles soient appliquées via Stripe.",
  alternates: buildAlternates("/referrals", "fr"),
  openGraph: {
    title: "Programme de parrainage Pulse",
    description: "Invitez une autre entreprise de services canadienne à Pulse avec un code de parrainage.",
    url: "https://www.pulseappointments.com/fr/referrals",
  },
};

export default function ReferralsPageFr() {
  return <ReferralsContent locale="fr" />;
}
