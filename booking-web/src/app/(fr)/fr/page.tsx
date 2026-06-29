import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildAlternates } from "@/lib/hreflang";
import { getDictionary } from "@/i18n/getDictionary";
import { getPlanLinks } from "@/lib/paymentLinks";
import { landingRedirectTarget } from "@/lib/landingSession";
import { HomeContent } from "@/components/marketing/HomeContent";

export async function generateMetadata(): Promise<Metadata> {
  const { home } = await getDictionary("fr");
  return {
    title: home.meta.title,
    description: home.meta.description,
    openGraph: { title: home.og.title, description: home.og.description },
    alternates: buildAlternates("/", "fr"),
  };
}

export default async function LandingPageFr() {
  const dest = await landingRedirectTarget();
  if (dest) redirect(dest);
  const [dict, planLinks] = await Promise.all([getDictionary("fr"), getPlanLinks()]);
  return <HomeContent dict={dict} locale="fr" planLinks={planLinks} />;
}
