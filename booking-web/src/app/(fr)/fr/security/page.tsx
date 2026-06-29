import type { Metadata } from "next";
import { getDictionary } from "@/i18n/getDictionary";
import { buildAlternates } from "@/lib/hreflang";
import { SecurityContent } from "@/components/marketing/SecurityContent";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary("fr");
  return {
    title: dict.security.meta.title,
    description: dict.security.meta.description,
    openGraph: { title: dict.security.meta.title, description: dict.security.meta.description },
    alternates: buildAlternates("/security", "fr"),
  };
}

export default async function SecurityPageFr() {
  const dict = await getDictionary("fr");
  return <SecurityContent dict={dict.security} altHref="/security" />;
}
