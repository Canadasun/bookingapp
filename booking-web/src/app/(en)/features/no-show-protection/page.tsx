import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { getDictionary } from "@/i18n/getDictionary";
import { FeatureDetail } from "@/components/marketing/FeatureDetail";

export async function generateMetadata(): Promise<Metadata> {
  const { featurePages } = await getDictionary("en");
  const p = featurePages["no-show-protection"];
  return {
    title: p.meta.title,
    description: p.meta.description,
    alternates: buildAlternates("/features/no-show-protection", "en"),
    openGraph: { title: p.og.title, description: p.og.description, url: "https://www.pulseappointments.com/features/no-show-protection" },
  };
}

export default async function Feature_no_show_protection_Page() {
  const dict = await getDictionary("en");
  return <FeatureDetail dict={dict} slug="no-show-protection" locale="en" />;
}
