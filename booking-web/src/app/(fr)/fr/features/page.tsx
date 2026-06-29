import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { getDictionary } from "@/i18n/getDictionary";
import { FeaturesContent } from "@/components/marketing/FeaturesContent";

export async function generateMetadata(): Promise<Metadata> {
  const { features } = await getDictionary("fr");
  return {
    title: features.meta.title,
    description: features.meta.description,
    alternates: buildAlternates("/features", "fr"),
    openGraph: {
      title: features.og.title,
      description: features.og.description,
      url: "https://www.pulseappointments.com/fr/features",
    },
  };
}

export default async function FeaturesPageFr() {
  const { features } = await getDictionary("fr");
  return <FeaturesContent dict={features} locale="fr" />;
}
