import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildAlternates } from "@/lib/hreflang";
import { IndustryPage } from "@/components/IndustryPage";
import { CityLandingPage } from "@/components/CityLandingPage";
import { industryContentFr } from "@/i18n/for/industries.fr";
import { cityContentFr } from "@/i18n/for/cities.fr";

const SITE_URL = "https://www.pulseappointments.com";

export const dynamicParams = false;

export function generateStaticParams() {
  return [...Object.keys(industryContentFr), ...Object.keys(cityContentFr)].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = industryContentFr[slug] ?? cityContentFr[slug];
  if (!content) return {};
  return {
    title: content.meta.title,
    description: content.meta.description,
    alternates: buildAlternates(`/for/${slug}`, "fr"),
    openGraph: { title: content.meta.ogTitle, description: content.meta.ogDescription },
  };
}

export default async function ForPageFr({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const industry = industryContentFr[slug];
  if (industry) {
    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/fr` },
        { "@type": "ListItem", position: 2, name: industry.breadcrumbName, item: `${SITE_URL}/fr/for/${slug}` },
      ],
    };
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
        <IndustryPage
          locale="fr"
          title={industry.title}
          headline={industry.headline}
          subheadline={industry.subheadline}
          heroEmoji={industry.heroEmoji}
          features={industry.features}
          checklist={industry.checklist}
        />
      </>
    );
  }

  const city = cityContentFr[slug];
  if (city) {
    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/fr` },
        { "@type": "ListItem", position: 2, name: city.breadcrumbName, item: `${SITE_URL}/fr/for/${slug}` },
      ],
    };
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
        <CityLandingPage
          locale="fr"
          city={city.city}
          province={city.province}
          titleKeyword={city.titleKeyword}
          primaryAudience={city.primaryAudience}
          localAngle={city.localAngle}
        />
      </>
    );
  }

  notFound();
}
