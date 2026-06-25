import Image from "next/image";
import Link from "next/link";
import type { ElementType } from "react";
import { CheckCircle2 } from "lucide-react";

type ComparisonValue = boolean | string;

export type FeatureLandingPageProps = {
  badge: string;
  badgeIcon: ElementType;
  title: string;
  titleAccent: string;
  description: string;
  slug: string;
  breadcrumbName: string;
  proofPoints: string[];
  steps: { num: string; title: string; desc: string }[];
  features: { icon: ElementType; title: string; body: string }[];
  comparisonTitle: string;
  competitors: string[];
  comparison: { feature: string; values: ComparisonValue[] }[];
  faqs: { q: string; a: string }[];
  ctaTitle: string;
  ctaText: string;
};

function Cell({ value }: { value: ComparisonValue }) {
  if (value === true) return <span className="text-violet-600 font-bold text-base" aria-label="Yes">✓</span>;
  if (value === false) return <span className="text-slate-300 text-base" aria-label="No">—</span>;
  return <span className="text-sm font-medium text-slate-500">{value}</span>;
}

export function FeatureLandingPage({
  badge,
  badgeIcon: BadgeIcon,
  title,
  titleAccent,
  description,
  slug,
  breadcrumbName,
  proofPoints,
  steps,
  features,
  comparisonTitle,
  competitors,
  comparison,
  faqs,
  ctaTitle,
  ctaText,
}: FeatureLandingPageProps) {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
      { "@type": "ListItem", position: 2, name: "Features", item: "https://www.pulseappointments.com/features" },
      { "@type": "ListItem", position: 3, name: breadcrumbName, item: `https://www.pulseappointments.com/features/${slug}` },
    ],
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <nav className="bg-white/80 backdrop-blur-xl border-b border-[#E9DDCB] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-slate-900 tracking-tight">Pulse Booking</span>
          </Link>
          <Link href="/register" className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors">
            Get started free
          </Link>
        </div>
      </nav>

      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-white border border-[#E9DDCB] text-sm font-semibold text-slate-700 px-4 py-1.5 rounded-full mb-8 shadow-sm">
          <BadgeIcon className="w-4 h-4 text-violet-600" aria-hidden="true" />
          {badge}
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          {title}{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600">
            {titleAccent}
          </span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">{description}</p>
        <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200">
          Get started free
        </Link>
        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {proofPoints.map((point) => (
            <div key={point} className="flex items-center gap-1.5 text-sm text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
              {point}
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 bg-white/60 border-y border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map(({ num, title: stepTitle, desc }) => (
              <div key={num} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm">
                <p className="text-6xl font-black mb-4 leading-none bg-gradient-to-br from-amber-400 to-orange-400 bg-clip-text text-transparent select-none">{num}</p>
                <h3 className="text-base font-bold text-slate-900 mb-2">{stepTitle}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">Built for daily service-business work</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title: featureTitle, body }) => (
              <div key={featureTitle} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-violet-600" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{featureTitle}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white/60 border-t border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">{comparisonTitle}</h2>
          <div className="overflow-x-auto rounded-2xl border border-[#E9DDCB] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E9DDCB]">
                  <th className="text-left px-6 py-4 font-semibold text-slate-900 w-[35%]">Feature</th>
                  <th className="px-4 py-4 font-bold text-violet-700 text-center">Pulse</th>
                  {competitors.map((name) => (
                    <th key={name} className="px-4 py-4 font-semibold text-slate-600 text-center">{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                    <td className="px-6 py-3.5 text-slate-700">{row.feature}</td>
                    {row.values.map((value, index) => (
                      <td key={`${row.feature}-${index}`} className={index === 0 ? "px-4 py-3.5 text-center bg-violet-50/40" : "px-4 py-3.5 text-center"}>
                        <Cell value={value} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map(({ q, a }) => (
              <div key={q} className="bg-white rounded-2xl border border-[#E9DDCB] p-6 shadow-sm">
                <p className="font-bold text-slate-900 mb-2">{q}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#19212B]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">{ctaTitle}</h2>
          <p className="text-white/60 mb-8">{ctaText}</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-8 py-4 rounded-xl hover:bg-violet-50 transition-colors">
            Get started free
          </Link>
        </div>
      </section>
    </main>
  );
}
