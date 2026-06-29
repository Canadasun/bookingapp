import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { getDictionary } from "@/i18n/getDictionary";
import { FeatureDetail } from "@/components/marketing/FeatureDetail";

export async function generateMetadata(): Promise<Metadata> {
  const { featurePages } = await getDictionary("en");
  const p = featurePages["intake-forms"];
  return {
    title: p.meta.title,
    description: p.meta.description,
    alternates: buildAlternates("/features/intake-forms", "en"),
    openGraph: { title: p.og.title, description: p.og.description, url: "https://www.pulseappointments.com/features/intake-forms" },
  };
}

export default async function Feature_intake_forms_Page() {
  const dict = await getDictionary("en");
  return <FeatureDetail dict={dict} slug="intake-forms" locale="en" />;
}
