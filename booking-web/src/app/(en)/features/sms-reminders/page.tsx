import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import { getDictionary } from "@/i18n/getDictionary";
import { FeatureDetail } from "@/components/marketing/FeatureDetail";

export async function generateMetadata(): Promise<Metadata> {
  const { featurePages } = await getDictionary("en");
  const p = featurePages["sms-reminders"];
  return {
    title: p.meta.title,
    description: p.meta.description,
    alternates: buildAlternates("/features/sms-reminders", "en"),
    openGraph: { title: p.og.title, description: p.og.description, url: "https://www.pulseappointments.com/features/sms-reminders" },
  };
}

export default async function Feature_sms_reminders_Page() {
  const dict = await getDictionary("en");
  return <FeatureDetail dict={dict} slug="sms-reminders" locale="en" />;
}
