import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import { buildAlternates } from "@/lib/hreflang";
import { getPlanLinks } from "@/lib/paymentLinks";
import { PricingContent } from "@/components/marketing/PricingContent";

export async function generateMetadata(): Promise<Metadata> {
  const { pricing } = await getDictionary("fr");
  return {
    title: pricing.meta.title,
    description: pricing.meta.description,
    openGraph: { title: pricing.og.title, description: pricing.og.description },
    alternates: buildAlternates("/pricing", "fr"),
  };
}

export default async function PricingPageFr() {
  const [{ pricing }, planLinks] = await Promise.all([getDictionary("fr"), getPlanLinks()]);
  return <PricingContent dict={pricing} planLinks={planLinks} locale="fr" />;
}
