import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildAlternates } from "@/lib/hreflang";
import { IndustryPage } from "@/components/IndustryPage";
import { industryContentFr } from "@/i18n/for/industries.fr";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(industryContentFr).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = industryContentFr[slug];
  if (!content) return {};
  return {
    title: content.meta.title,
    description: content.meta.description,
    alternates: buildAlternates(`/for/${slug}`, "fr"),
    openGraph: { title: content.meta.ogTitle, description: content.meta.ogDescription },
  };
}

export default async function IndustryPageFr({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = industryContentFr[slug];
  if (!content) notFound();

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://www.pulseappointments.com/fr" },
      { "@type": "ListItem", position: 2, name: content.breadcrumbName, item: `https://www.pulseappointments.com/fr/for/${slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <IndustryPage
        locale="fr"
        title={content.title}
        headline={content.headline}
        subheadline={content.subheadline}
        heroEmoji={content.heroEmoji}
        features={content.features}
        checklist={content.checklist}
      />
    </>
  );
}
