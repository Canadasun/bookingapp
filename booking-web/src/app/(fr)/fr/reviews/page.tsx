import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { ReviewsContent } from "@/components/marketing/ReviewsContent";

export const metadata: Metadata = {
  title: "Collecte d’avis clients pour les entreprises de services | Pulse Appointments",
  description: "Pulse aide les entreprises de services canadiennes à recueillir, modérer et publier de vrais avis de rendez-vous, sans témoignages fictifs.",
  alternates: buildAlternates("/reviews", "fr"),
  openGraph: {
    title: "Collecte de vrais avis | Pulse Appointments",
    description: "Recueillez et publiez des avis liés à des rendez-vous terminés.",
    url: "https://www.pulseappointments.com/fr/reviews",
  },
};

export default function ReviewsMarketingPageFr() {
  return <ReviewsContent locale="fr" />;
}
