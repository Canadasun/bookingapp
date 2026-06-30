import Link from "next/link";
import { Check, X, ShieldCheck, ArrowRight, Truck } from "lucide-react";

export interface CompareFeature {
  feature: string;
  pulse: boolean | string;
  them: boolean | string;
  highlight?: boolean;
}

export interface ComparePageProps {
  competitor: string;
  competitorUrl?: string;
  locale?: "en" | "fr";
  tagline: string;
  summary: string;
  pulseWins: string[];
  theyWin: string[];
  features: CompareFeature[];
  pricingComparison: {
    pulseLabel: string;
    pulsePrice: string;
    pulseCurrency: string;
    themLabel: string;
    themPrice: string;
    themCurrency: string;
    themNote?: string;
  };
  urgencyBanner?: {
    icon: string;
    title: string;
    body: string;
  };
}

function Cell({ value }: { value: boolean | string }) {
  if (value === true)  return <Check className="w-5 h-5 text-emerald-600 mx-auto" />;
  if (value === false) return <X className="w-5 h-5 text-red-400 mx-auto" />;
  return <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{value}</span>;
}

export function ComparePage({
  competitor, tagline, summary, pulseWins, theyWin,
  features, pricingComparison, urgencyBanner, locale = "en",
}: ComparePageProps) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const pricingHref = fr ? "/fr/pricing" : "/pricing";
  const securityHref = fr ? "/fr/security" : "/security";
  const canadianPrivacyHref = fr ? "/fr/canadian-privacy" : "/canadian-privacy";
  const privacyHref = fr ? "/fr/privacy" : "/privacy";
  const termsHref = fr ? "/fr/terms" : "/terms";
  const compareHref = fr ? "/fr/compare" : "/compare";
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: fr ? [
      {
        "@type": "Question",
        name: `Pulse est-il meilleur que ${competitor} pour les entreprises de services canadiennes?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Pulse convient généralement mieux lorsqu’une entreprise de services canadienne a besoin de prix en CAD, de réservation en ligne, d’acomptes, de protection contre les absences, de dossiers clients et de rappels dans un seul flux. ${competitor} peut tout de même être plus avantageux pour les équipes qui ont besoin de son écosystème ou de ses intégrations particulières.`,
        },
      },
      {
        "@type": "Question",
        name: `Pulse prend-il en charge les prix en CAD par rapport à ${competitor}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "Oui. Les prix de Pulse sont affichés en dollars canadiens et conçus pour les entreprises de services canadiennes qui veulent éviter les surprises de conversion de devises.",
        },
      },
      {
        "@type": "Question",
        name: `Puis-je migrer de ${competitor} vers Pulse?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "Oui. Pulse offre un soutien de migration gratuit pour les menus de services, les listes de clients, les profils du personnel et la configuration de base afin que les entreprises puissent changer avec moins de travail manuel.",
        },
      },
    ] : [
      {
        "@type": "Question",
        name: `Is Pulse better than ${competitor} for Canadian service businesses?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Pulse is usually a better fit when a Canadian service business needs CAD pricing, online booking, deposits, no-show protection, client records, and reminders in one workflow. ${competitor} may still be stronger for teams that need its specific ecosystem or integrations.`,
        },
      },
      {
        "@type": "Question",
        name: `Does Pulse support CAD pricing compared with ${competitor}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Pulse pricing is shown in Canadian dollars and is designed for Canadian service businesses that want fewer currency-conversion surprises.",
        },
      },
      {
        "@type": "Question",
        name: `Can I migrate from ${competitor} to Pulse?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Pulse offers free migration support for service menus, client lists, staff profiles, and core booking setup so businesses can switch with less manual work.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      {/* Nav */}
      <nav className="border-b border-slate-100 bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href={home} className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="Pulse" className="w-7 h-7 object-contain" />
            <span className="text-lg font-bold text-slate-900">Pulse Appointments</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href={pricingHref} className="text-sm text-slate-600 hover:text-violet-600 hidden sm:block">{fr ? "Tarifs" : "Pricing"}</Link>
            <Link href="/migrate" className="text-sm text-slate-600 hover:text-violet-600 hidden sm:block">{fr ? "Migration gratuite" : "Free Migration"}</Link>
            <Link href="/register" className="text-sm font-semibold bg-violet-600 text-white rounded-lg px-4 py-1.5 hover:bg-violet-700 transition-colors">
              {fr ? "Essayer gratuitement →" : "Try free →"}
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">

        {/* Urgency banner (Jane forced payment etc.) */}
        {urgencyBanner && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-4">
            <span className="text-2xl shrink-0" aria-hidden="true">{urgencyBanner.icon}</span>
            <div>
              <p className="text-sm font-bold text-amber-900">{urgencyBanner.title}</p>
              <p className="text-sm text-amber-800 mt-1">{urgencyBanner.body}</p>
              <Link
                href="/migrate"
                className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-amber-900 underline hover:no-underline"
              >
                {fr ? "Passez à Pulse — migration gratuite en 48 h" : "Switch to Pulse — free migration in 48h"} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-4">
          <p className="text-sm font-semibold text-violet-600">{tagline}</p>
          <h1 className="text-4xl font-bold text-slate-900">Pulse vs. {competitor}</h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">{summary}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-violet-600 text-white font-semibold text-sm rounded-xl px-6 py-2.5 hover:bg-violet-700 transition-colors"
            >
              {fr ? "Commencez gratuitement — sans carte de crédit" : "Start free — no credit card"}
            </Link>
            <Link
              href="/migrate"
              className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 font-semibold text-sm rounded-xl px-6 py-2.5 hover:bg-slate-50 transition-colors"
            >
              <Truck className="w-4 h-4" /> {fr ? `Migration gratuite depuis ${competitor}` : `Free migration from ${competitor}`}
            </Link>
          </div>
        </div>

        {/* Wins/losses */}
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="text-base font-semibold text-emerald-800 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> {fr ? "Là où Pulse gagne" : "Where Pulse wins"}
            </h2>
            <ul className="space-y-2.5">
              {pulseWins.map((w) => (
                <li key={w} className="flex items-start gap-2 text-sm text-emerald-800">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> {w}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-base font-semibold text-slate-600 mb-3">{fr ? `Là où ${competitor} gagne` : `Where ${competitor} wins`}</h2>
            <ul className="space-y-2.5">
              {theyWin.map((w) => (
                <li key={w} className="flex items-start gap-2 text-sm text-slate-500">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" /> {w}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Pricing comparison */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-5 text-center">{fr ? "Tarifs — côte à côte" : "Pricing — side by side"}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-violet-500 bg-white p-5 text-center">
              <p className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-1">Pulse</p>
              <p className="text-4xl font-extrabold text-slate-900">{pricingComparison.pulsePrice}</p>
              <p className="text-xs text-violet-700 mt-1">{pricingComparison.pulseLabel}</p>
              <p className="text-xs text-violet-600 mt-1 font-medium">{pricingComparison.pulseCurrency}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{competitor}</p>
              <p className="text-4xl font-extrabold text-slate-500">{pricingComparison.themPrice}</p>
              <p className="text-xs text-slate-400 mt-1">{pricingComparison.themLabel}</p>
              <p className="text-xs text-slate-400 mt-1">{pricingComparison.themCurrency}</p>
              {pricingComparison.themNote && (
                <p className="text-xs text-amber-600 font-medium mt-2">{pricingComparison.themNote}</p>
              )}
            </div>
          </div>
        </div>

        {/* Feature table */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-3 bg-slate-900 text-white text-sm font-semibold">
            <div className="p-4">{fr ? "Fonctionnalité" : "Feature"}</div>
            <div className="p-4 text-center border-l border-slate-700 text-violet-300">Pulse</div>
            <div className="p-4 text-center border-l border-slate-700 text-slate-300">{competitor}</div>
          </div>
          <div className="divide-y divide-slate-100">
            {features.map((f) => (
              <div
                key={f.feature}
                className={`grid grid-cols-3 text-sm ${f.highlight ? "bg-violet-50" : "bg-white"}`}
              >
                <div className="p-4 text-slate-700 font-medium flex items-center gap-2">
                  {f.highlight && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />}
                  {f.feature}
                </div>
                <div className="p-4 text-center border-l border-slate-100"><Cell value={f.pulse} /></div>
                <div className="p-4 text-center border-l border-slate-100"><Cell value={f.them} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* Migration guarantee strip */}
        <div className="rounded-2xl bg-violet-600 text-white p-7 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <Truck className="w-8 h-8 shrink-0 opacity-80 mt-0.5" />
            <div>
              <p className="font-bold text-lg">{fr ? `Vous quittez ${competitor}? Nous vous migrons gratuitement.` : `Switch from ${competitor}? We move you for free.`}</p>
              <p className="text-violet-200 text-sm mt-1">
                {fr ? "Liste de clients, menu de services, profils du personnel — migrés en 48 heures. Aucune compétence technique requise." : "Client list, service menu, staff profiles — migrated in 48 hours. No tech skills needed."}
              </p>
            </div>
          </div>
          <Link
            href="/migrate"
            className="shrink-0 bg-white text-violet-700 font-bold text-sm px-6 py-3 rounded-xl hover:bg-violet-50 transition-colors whitespace-nowrap"
          >
            {fr ? "Demander une migration gratuite" : "Request free migration"}
          </Link>
        </div>

        {/* Bottom CTA */}
        <div className="text-center space-y-4 py-4">
          <h2 className="text-2xl font-bold text-slate-900">{fr ? "Prêt à essayer Pulse?" : "Ready to try Pulse?"}</h2>
          <p className="text-slate-500 text-base">
            {fr ? "Forfait gratuit sans limite de temps. Prix en CAD. Aucune carte de crédit requise." : "Free plan with no time limit. CAD pricing. No credit card required."}
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-violet-600 text-white font-semibold text-base rounded-xl px-8 py-3.5 hover:bg-violet-700 transition-colors"
          >
            {fr ? "Commencer gratuitement →" : "Get started free →"}
          </Link>
          <p className="text-xs text-slate-400">{fr ? "Configuration en moins de 5 minutes · Annulez à tout moment" : "Setup in under 5 minutes · Cancel anytime"}</p>
        </div>

      </div>

      <footer className="border-t border-slate-100 bg-slate-50 mt-4">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href={home} className="text-sm font-semibold text-slate-700">Pulse Appointments</Link>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <Link href={pricingHref}       className="hover:text-violet-600">{fr ? "Tarifs" : "Pricing"}</Link>
            <Link href={compareHref}       className="hover:text-violet-600">{fr ? "Comparer" : "Compare"}</Link>
            <Link href="/migrate"       className="hover:text-violet-600">{fr ? "Migration gratuite" : "Free Migration"}</Link>
            <Link href={securityHref}      className="hover:text-violet-600">{fr ? "Sécurité" : "Security"}</Link>
            <Link href={canadianPrivacyHref} className="hover:text-violet-600">{fr ? "Vie privée au Canada" : "Canadian Privacy"}</Link>
            <Link href={privacyHref}       className="hover:text-violet-600">{fr ? "Confidentialité" : "Privacy"}</Link>
            <Link href={termsHref}         className="hover:text-violet-600">{fr ? "Conditions" : "Terms"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
