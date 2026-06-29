import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import { buildAlternates } from "@/lib/hreflang";
import { SecurityContent } from "@/components/marketing/SecurityContent";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary("en");
  return {
    title: dict.security.meta.title,
    description: dict.security.meta.description,
    openGraph: { title: dict.security.meta.title, description: dict.security.meta.description },
    alternates: buildAlternates("/security", "en"),
  };
}

export default async function SecurityPage() {
  const dict = await getDictionary("en");
  return <SecurityContent dict={dict.security} altHref="/fr/security" />;
}
