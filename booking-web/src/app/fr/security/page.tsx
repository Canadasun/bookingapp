import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import { localeHtmlLang } from "@/i18n/config";
import { HtmlLang } from "@/components/marketing/HtmlLang";
import { SecurityContent } from "@/components/marketing/SecurityContent";

const SITE = "https://www.pulseappointments.com";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary("fr");
  return {
    title: dict.security.meta.title,
    description: dict.security.meta.description,
    openGraph: { title: dict.security.meta.title, description: dict.security.meta.description },
    alternates: {
      canonical: `${SITE}/fr/security`,
      languages: { "en-CA": `${SITE}/security`, "fr-CA": `${SITE}/fr/security` },
    },
  };
}

export default async function SecurityPageFr() {
  const dict = await getDictionary("fr");
  return (
    <>
      <HtmlLang lang={localeHtmlLang.fr} />
      <SecurityContent dict={dict.security} altHref="/security" />
    </>
  );
}
