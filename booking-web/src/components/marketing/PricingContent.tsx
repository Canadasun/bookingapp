import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import type { Dictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import { PLAN_DEFS, PLAN_FEATURES } from "@/lib/plans";
import type { FeatureValue } from "@/lib/plans";
import type { PlanLinks } from "@/lib/paymentLinks";
import { LanguageToggle } from "./LanguageToggle";

type PricingDict = Dictionary["pricing"];

function Cell({ value }: { value: FeatureValue }) {
  if (value === true) return <span className="text-violet-600 font-bold text-base" aria-label="Included">✓</span>;
  if (value === false) return <span className="text-slate-300 text-base" aria-label="Not included">—</span>;
  return <span className="text-sm font-semibold text-slate-700">{value}</span>;
}

// Prices and the feature matrix live in @/lib/plans (single source of truth);
// every visible string comes from the dictionary so EN and FR render from the
// exact same component. Plan rows are keyed by id and feature rows by index,
// which a unit test pins to the dictionary length to prevent drift.
export function PricingContent({
  dict,
  planLinks,
  locale,
}: {
  dict: PricingDict;
  planLinks: Partial<PlanLinks>;
  locale: Locale;
}) {
  const money = (n: number) => (locale === "fr" ? `${n} $` : `$${n}`);
  const localizeValue = (v: FeatureValue): FeatureValue => (v === "1/mo" ? dict.perMonthFee : v);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: dict.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-[#E9DDCB] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href={locale === "fr" ? "/fr/pricing" : "/"} className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-slate-900 tracking-tight">{dict.nav.brand}</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageToggle locale={locale} enHref="/pricing" frHref="/fr/pricing" label={dict.toggleLabel} />
            <Link
              href="/register"
              className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors"
            >
              {dict.nav.cta}
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">{dict.hero.title}</h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">{dict.hero.subtitle}</p>
        </div>

        {/* Plan cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {PLAN_DEFS.map((plan) => {
            const p = dict.plans[plan.id];
            const links = plan.id === "FREE" ? undefined : planLinks[plan.id];
            const monthlyHref = plan.price > 0 ? (links?.month ?? `${plan.href}&billing=monthly`) : plan.href;
            const annualHref = links?.year ?? `${plan.href}&billing=annual`;
            const period = plan.period === "forever" ? dict.periods.forever : dict.periods.month;
            return (
              <div
                key={plan.id}
                className={
                  plan.highlight
                    ? "rounded-3xl border-2 border-violet-600 bg-white p-7 shadow-xl shadow-violet-100 relative"
                    : "rounded-3xl border border-[#E9DDCB] bg-white p-7 shadow-sm"
                }
              >
                {plan.highlight && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full tracking-wide">
                    {dict.mostPopular}
                  </span>
                )}
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">{p.name}</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                    {plan.price === 0 ? dict.priceFree : money(plan.price)}
                  </span>
                  {plan.price > 0 && <span className="text-sm text-slate-400 mb-1.5">{period}</span>}
                </div>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">{p.desc}</p>
                {plan.price > 0 && (
                  <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{dict.annual.label}</p>
                    <p className="mt-1 text-sm text-emerald-900">
                      {dict.annual.perYear.replace("{price}", String(plan.annualPrice))}{" "}
                      <span className="text-emerald-700">· {dict.annual.monthsFree}</span>
                    </p>
                  </div>
                )}
                <a
                  href={monthlyHref}
                  className={
                    plan.highlight
                      ? "flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors"
                      : "flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#E9DDCB] bg-white text-slate-800 font-semibold text-sm hover:bg-violet-50 transition-colors"
                  }
                >
                  {plan.highlight && <Sparkles className="h-4 w-4" />}
                  {p.cta}
                </a>
                {plan.price > 0 && (
                  <a
                    href={annualHref}
                    className="mt-2 flex items-center justify-center w-full py-3 rounded-xl bg-emerald-50 text-emerald-700 font-semibold text-sm hover:bg-emerald-100 transition-colors"
                  >
                    {dict.annual.cta}
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* Feature table */}
        <div className="overflow-x-auto rounded-3xl border border-[#E9DDCB] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E9DDCB]">
                <th className="text-left px-6 py-4 font-semibold text-slate-900 w-[40%]">{dict.table.feature}</th>
                {PLAN_DEFS.map((p) => (
                  <th
                    key={p.id}
                    className={
                      p.highlight
                        ? "px-4 py-4 font-bold text-violet-700 text-center"
                        : "px-4 py-4 font-semibold text-slate-700 text-center"
                    }
                  >
                    {dict.plans[p.id].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_FEATURES.map((f, i) => (
                <tr key={f.label} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                  <td className="px-6 py-3.5 text-slate-700">{dict.features[i]}</td>
                  <td className="px-4 py-3.5 text-center"><Cell value={localizeValue(f.free)} /></td>
                  <td className="px-4 py-3.5 text-center"><Cell value={localizeValue(f.basic)} /></td>
                  <td className="px-4 py-3.5 text-center bg-violet-50/40"><Cell value={localizeValue(f.pro)} /></td>
                  <td className="px-4 py-3.5 text-center"><Cell value={localizeValue(f.unlimited)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 px-6 py-3 border-t border-[#E9DDCB]">{dict.table.footnote}</p>
        </div>

        {/* FAQ / reassurance */}
        <div className="mt-16 grid sm:grid-cols-3 gap-8 text-center">
          {dict.faq.map(({ q, a }) => (
            <div key={q} className="rounded-2xl border border-[#E9DDCB] bg-white p-6">
              <p className="font-bold text-slate-900 mb-2">{q}</p>
              <p className="text-sm text-slate-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-3xl bg-[#19212B] p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">{dict.ctaSection.title}</h2>
          <p className="text-white/60 mb-8">{dict.ctaSection.subtitle}</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-8 py-4 rounded-xl hover:bg-violet-50 transition-colors"
          >
            <Sparkles className="h-5 w-5" /> {dict.ctaSection.button}
          </Link>
          <p className="mt-4 text-xs text-white/40">
            {dict.ctaSection.questions}{" "}
            <Link href="/support" className="underline hover:text-white/70 transition-colors">
              {dict.ctaSection.supportLink}
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E9DDCB] bg-white/80 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-slate-400">© {new Date().getFullYear()} Pulse Appointments</span>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-indigo-600 transition-colors">{dict.footer.home}</Link>
            <Link href="/terms" className="hover:text-indigo-600 transition-colors">{dict.footer.terms}</Link>
            <Link href="/privacy" className="hover:text-indigo-600 transition-colors">{dict.footer.privacy}</Link>
            <Link href="/support" className="hover:text-indigo-600 transition-colors">{dict.footer.support}</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
