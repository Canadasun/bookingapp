import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import { SecurityContent } from "@/components/marketing/SecurityContent";

const SITE = "https://www.pulseappointments.com";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary("en");
  return {
    title: dict.security.meta.title,
    description: dict.security.meta.description,
    openGraph: { title: dict.security.meta.title, description: dict.security.meta.description },
    alternates: {
      canonical: `${SITE}/security`,
      languages: {
        "en-CA": `${SITE}/security`,
        "fr-CA": `${SITE}/fr/security`,
        "x-default": `${SITE}/security`,
      },
    },
  };
}

export default async function SecurityPage() {
  const dict = await getDictionary("en");
  return <SecurityContent dict={dict.security} altHref="/fr/security" />;
}
