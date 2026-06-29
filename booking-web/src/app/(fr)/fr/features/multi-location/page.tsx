import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { getDictionary } from "@/i18n/getDictionary";
import { FeatureDetail } from "@/components/marketing/FeatureDetail";

export async function generateMetadata(): Promise<Metadata> {
  const { featurePages } = await getDictionary("fr");
  const p = featurePages["multi-location"];
  return {
    title: p.meta.title,
    description: p.meta.description,
    alternates: buildAlternates("/features/multi-location", "fr"),
    openGraph: { title: p.og.title, description: p.og.description, url: "https://www.pulseappointments.com/fr/features/multi-location" },
  };
}

export default async function Feature_multi_location_PageFr() {
  const dict = await getDictionary("fr");
  return <FeatureDetail dict={dict} slug="multi-location" locale="fr" />;
}
