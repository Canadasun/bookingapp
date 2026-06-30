import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildAlternates } from "@/lib/hreflang";
import { ComparePage } from "@/components/ComparePage";
import { compareContentFr } from "@/i18n/compare/competitors.fr";

const SITE_URL = "https://www.pulseappointments.com";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(compareContentFr).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = compareContentFr[slug];
  if (!content) return {};
  return {
    title: content.meta.title,
    description: content.meta.description,
    alternates: buildAlternates(`/compare/${slug}`, "fr"),
  };
}

export default async function ComparePageFr({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = compareContentFr[slug];
  if (!content) notFound();

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/fr` },
      { "@type": "ListItem", position: 2, name: "Comparer", item: `${SITE_URL}/fr/compare` },
      { "@type": "ListItem", position: 3, name: content.breadcrumbName, item: `${SITE_URL}/fr/compare/${slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ComparePage
        locale="fr"
        competitor={content.competitor}
        tagline={content.tagline}
        summary={content.summary}
        pulseWins={content.pulseWins}
        theyWin={content.theyWin}
        features={content.features}
        pricingComparison={content.pricingComparison}
        urgencyBanner={content.urgencyBanner}
      />
    </>
  );
}
