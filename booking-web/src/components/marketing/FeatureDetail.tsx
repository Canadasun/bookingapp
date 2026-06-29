import type { Dictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import { FeatureLandingPage } from "@/components/FeatureLandingPage";
import { featureRig } from "./featureRig";

export type FeatureSlug = keyof Dictionary["featurePages"];

// Thin wrapper that assembles a feature detail page from the dictionary content
// (text) and the icon registry (icons), for either locale. Each EN/FR page is
// then just a one-liner that picks its slug + locale.
export function FeatureDetail({
  dict,
  slug,
  locale,
}: {
  dict: Dictionary;
  slug: FeatureSlug;
  locale: Locale;
}) {
  const p = dict.featurePages[slug];
  const rig = featureRig[slug];
  return (
    <FeatureLandingPage
      ui={dict.featureUi}
      locale={locale}
      slug={slug}
      badge={p.badge}
      badgeIcon={rig.badgeIcon}
      title={p.title}
      titleAccent={p.titleAccent}
      description={p.description}
      breadcrumbName={p.breadcrumbName}
      proofPoints={p.proofPoints}
      stepsTitle={p.stepsTitle}
      steps={p.steps}
      featuresTitle={p.featuresTitle}
      features={p.features.map((f, i) => ({ ...f, icon: rig.featureIcons[i] }))}
      comparisonTitle={p.comparisonTitle}
      competitors={p.competitors}
      comparison={p.comparison}
      faqs={p.faqs}
      ctaTitle={p.ctaTitle}
      ctaText={p.ctaText}
      footer={dict.featureUi.footer}
    />
  );
}
