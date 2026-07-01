import Image from "next/image";
import { Clock, Bell, CreditCard, CheckCircle2, ArrowRight, Zap, ClipboardList, Globe, Users, Star, ShieldCheck, MousePointerClick, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import { PLAN_DEFS } from "@/lib/plans";
import type { PlanLinks } from "@/lib/paymentLinks";
import {
  LandingAuthCta,
  LandingHeroCta,
  LandingBottomCta,
  LandingFooterLinks,
  LandingResources,
  LandingSolutions,
} from "@/components/LandingClient";
import { LanguageToggle } from "./LanguageToggle";
import { CanadaBrandBackdrop } from "./CanadaBrandBackdrop";
import { HomeVideoProof } from "./HomeVideoProof";

// Icons/colours live in code, paired by index with the dictionary copy so the
// page renders identically in EN and FR with only the words changing.
const FEATURE_META: { Icon: LucideIcon; iconBg: string; iconColor: string }[] = [
  { Icon: Clock, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  { Icon: Bell, iconBg: "bg-violet-50", iconColor: "text-violet-700" },
  { Icon: CreditCard, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { Icon: ClipboardList, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  { Icon: Globe, iconBg: "bg-sky-50", iconColor: "text-sky-600" },
  { Icon: Users, iconBg: "bg-violet-50", iconColor: "text-violet-700" },
];
const TOUR_ICONS: LucideIcon[] = [MousePointerClick, CreditCard, Star];
const WORKFLOW_COLORS = ["bg-violet-400", "bg-amber-400", "bg-teal-400"];
const WORKFLOW_STEP_NUM = ["01", "02", "03"];

export function HomeContent({
  dict,
  locale,
  planLinks,
}: {
  dict: Dictionary;
  locale: Locale;
  planLinks: Partial<PlanLinks>;
}) {
  const h = dict.home;
  const pricingHref = locale === "fr" ? "/fr/pricing" : "/pricing";
  const homepageVideoId = process.env.HOMEPAGE_YOUTUBE_VIDEO_ID?.trim() ?? "";
  const validVideoId = /^[A-Za-z0-9_-]{11}$/.test(homepageVideoId) ? homepageVideoId : null;
  const videoUploadDate = process.env.HOMEPAGE_VIDEO_UPLOAD_DATE?.trim();

  const jsonLdOrg = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Pulse Appointments",
    url: "https://www.pulseappointments.com",
    logo: "https://www.pulseappointments.com/logo-icon.png",
    contactPoint: { "@type": "ContactPoint", email: "support@pulseappointments.com", contactType: "customer support" },
  };
  const jsonLdSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Pulse Appointments",
    url: "https://www.pulseappointments.com",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "https://www.pulseappointments.com/book?q={search_term_string}" },
      "query-input": "required name=search_term_string",
    },
  };
  const jsonLdApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Pulse Appointments",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Appointment Scheduling Software",
    operatingSystem: "Web, iOS, Android",
    url: "https://www.pulseappointments.com",
    description: h.jsonLd.appDescription,
    offers: { "@type": "Offer", price: "0", priceCurrency: "CAD", description: h.jsonLd.offerDescription },
  };
  const jsonLdVideo = validVideoId && /^\d{4}-\d{2}-\d{2}$/.test(videoUploadDate ?? "")
    ? {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: h.videoProof.title,
        description: h.videoProof.body,
        thumbnailUrl: `https://i.ytimg.com/vi/${validVideoId}/maxresdefault.jpg`,
        uploadDate: videoUploadDate,
        embedUrl: `https://www.youtube-nocookie.com/embed/${validVideoId}`,
        contentUrl: `https://www.youtube.com/watch?v=${validVideoId}`,
      }
    : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSite) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdApp) }} />
      {jsonLdVideo && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdVideo) }} />}
    <div className="flex flex-col min-h-screen brand-shell">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-ink tracking-tight">{h.nav.brand}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle locale={locale} enHref="/" frHref="/fr" label={h.toggleLabel} />
            <LandingAuthCta t={h.authCta} locale={locale} />
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <CanadaBrandBackdrop />
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="animate-blob absolute -top-32 -left-28 w-[540px] h-[540px] rounded-full bg-amber-300/18 blur-3xl" />
          <div className="animate-blob-alt absolute -top-10 right-[-10rem] w-[440px] h-[440px] rounded-full bg-teal-400/14 blur-3xl" />
          <div className="animate-blob absolute bottom-8 left-1/2 -translate-x-1/2 w-[380px] h-[380px] rounded-full bg-orange-300/10 blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-8 text-center">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-[#E9DDCB] bg-white/92 px-4 py-1.5 text-sm font-medium text-ink shadow-sm backdrop-blur-sm mb-5">
            <span className="inline-flex items-center justify-center rounded-full bg-slate-50 px-1.5 py-1">
              <Image src="/logo-icon.png" alt="" width={16} height={16} className="h-4 w-4 object-contain" />
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[#D80621]" />
              {locale === "fr" ? "SaaS d’abord canadien" : "Canada-first SaaS"}
            </span>
          </div>

          <h1 className="animate-fade-up-d1 text-5xl sm:text-6xl font-semibold text-ink tracking-tight leading-[1.06] mb-6">
            {h.hero.headlinePre}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D80621] via-orange-500 to-amber-500">
              {h.hero.headlineHighlight}
            </span>
          </h1>

          <p className="animate-fade-up-d2 text-lg text-slate-600 max-w-xl mx-auto mb-10 leading-relaxed">
            {h.hero.subtitle}
          </p>

          <div className="animate-fade-up-d2 mb-10 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E9DDCB] bg-white/80 px-3 py-1 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D80621]" />
              {locale === "fr" ? "Conçu pour les entreprises de services canadiennes" : "Built for Canadian service businesses"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E9DDCB] bg-white/80 px-3 py-1 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {locale === "fr" ? "Bilingue EN/FR" : "Bilingual EN/FR"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E9DDCB] bg-white/80 px-3 py-1 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {locale === "fr" ? "Tarification en CAD" : "CAD pricing"}
            </span>
          </div>

          <div className="animate-fade-up-d3">
            <LandingHeroCta t={h.heroCta} locale={locale} />
          </div>
        </div>

        {/* Product workflow card */}
        <div className="relative max-w-sm mx-auto px-6 pb-24">
          <div className="brand-panel rounded-[2rem] p-4 shadow-2xl shadow-amber-100">
            <div className="bg-[#19212B] rounded-[1.5rem] p-5 text-white">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[11px] text-white/45 uppercase tracking-widest mb-0.5">{h.workflow.eyebrow}</p>
                  <p className="text-xl font-bold">{h.workflow.title}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Zap className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-2.5">
                {h.workflow.steps.map(({ label, detail }, i) => (
                  <div key={label} className="flex items-center gap-3 bg-white/[0.07] rounded-2xl px-4 py-3 hover:bg-white/[0.10] transition-colors">
                    <p className="text-xs font-bold text-white/50 w-10 shrink-0">{WORKFLOW_STEP_NUM[i]}</p>
                    <div className={`w-1 h-8 rounded-full ${WORKFLOW_COLORS[i]} shrink-0`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{label}</p>
                      <p className="text-xs text-white/45 truncate">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold shadow-lg shadow-amber-500/25">
                <Bell className="w-4 h-4" /> {h.workflow.pill}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <div className="py-4 border-y border-[#E9DDCB]/70 bg-white/60 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          {h.trust.map((t) => (
            <div key={t} className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Logged-in owner shortcuts (render null for public visitors) ── */}
      <LandingResources />
      <LandingSolutions />

      {/* Real product proof. Kept completely out of the DOM until a valid
          YouTube ID is configured, so a pending asset never creates a blank or
          fabricated-proof section on the public homepage. */}
      {validVideoId && (
        <section className="border-y border-[#E9DDCB] bg-[#F8F5EF] py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-violet-600">{h.videoProof.eyebrow}</p>
              <h2 className="mb-4 text-3xl font-bold text-ink">{h.videoProof.title}</h2>
              <p className="leading-relaxed text-slate-500">{h.videoProof.body}</p>
            </div>
            <HomeVideoProof
              videoId={validVideoId}
              title={h.videoProof.playerTitle}
              playLabel={h.videoProof.playLabel}
              privacyNote={h.videoProof.privacyNote}
            />
          </div>
        </section>
      )}

      {/* ── Product tour ── */}
      <section className="py-20 border-y border-[#E9DDCB] bg-white">
        <div className="max-w-6xl mx-auto px-6 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-3">{h.tour.eyebrow}</p>
            <h2 className="text-3xl font-bold text-ink mb-4">{h.tour.title}</h2>
            <p className="text-slate-500 leading-relaxed mb-6">{h.tour.body}</p>
            <div className="space-y-3">
              {h.tour.items.map(({ title, desc }, i) => {
                const Icon = TOUR_ICONS[i];
                return (
                  <div key={title} className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                      <Icon className="h-4 w-4 text-violet-700" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={locale === "fr" ? "/fr/features" : "/demo"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                {h.tour.viewTour} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href={locale === "fr" ? "/fr/features/reviews" : "/reviews"} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E9DDCB] bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-violet-50 transition-colors">
                {h.tour.reviewCollection}
              </a>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[#E9DDCB] bg-[#F8F5EF] p-4 shadow-xl shadow-amber-100/60">
            <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="ml-3 rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">pulseappointments.com/book/studio</span>
              </div>
              <div className="grid md:grid-cols-[0.8fr_1.2fr]">
                <div className="bg-[#19212B] p-5 text-white">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500" />
                    <div>
                      <p className="text-sm font-bold">Northline Studio</p>
                      <p className="text-xs text-white/45">{h.tour.mockup.location}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {h.tour.mockup.services.map(({ name, price, note }) => (
                      <div key={name} className="rounded-2xl bg-white/[0.07] p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{name}</span>
                          <span className="text-xs text-white/50">{price}</span>
                        </div>
                        <p className="mt-1 text-xs text-white/40">{note}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{h.tour.mockup.availableTimes}</p>
                      <p className="text-lg font-bold text-slate-900">{h.tour.mockup.date}</p>
                    </div>
                    <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {h.tour.mockup.times.map((time, index) => (
                      <div key={time} className={index === 2 ? "rounded-xl bg-violet-600 px-3 py-3 text-center text-sm font-semibold text-white" : "rounded-xl border border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700"}>
                        {time}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900">{h.tour.mockup.depositCollected}</p>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-700">{h.tour.mockup.depositNote}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 bg-white/60 border-y border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-ink mb-3">{h.howItWorks.title}</h2>
            <p className="text-slate-500 max-w-md mx-auto">{h.howItWorks.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {h.howItWorks.steps.map(({ num, title, desc }) => (
              <div key={num} className="relative bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm overflow-hidden group hover:shadow-md hover:shadow-amber-50 hover:-translate-y-0.5 transition-all duration-200">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-50 to-transparent rounded-bl-3xl" />
                <p className="text-7xl font-black mb-4 leading-none bg-gradient-to-br from-amber-400 to-orange-400 bg-clip-text text-transparent select-none">{num}</p>
                <h3 className="text-base font-bold text-ink mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-ink mb-3">{h.features.title}</h2>
            <p className="text-slate-500 max-w-md mx-auto">{h.features.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {h.features.items.map(({ title, desc }, i) => {
              const { Icon, iconBg, iconColor } = FEATURE_META[i];
              return (
                <div key={title} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 hover:shadow-xl hover:shadow-amber-50/80 hover:-translate-y-1 transition-all duration-200 group">
                  <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <h3 className="text-base font-bold text-ink mb-2">{title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <section className="py-16 bg-gradient-to-b from-[#FFFAF2] to-white border-t border-[#E9DDCB]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-sm text-slate-500 mb-6">{h.socialProof.label}</p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
            {h.socialProof.niches.map((niche) => (
              <span key={niche}>{niche}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing comparison ── */}
      <section className="py-24 bg-white/60 border-t border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-ink mb-3">{h.pricingPreview.title}</h2>
            <p className="text-slate-500 max-w-md mx-auto">{h.pricingPreview.subtitle}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {PLAN_DEFS.map((plan) => {
              const p = dict.pricing.plans[plan.id];
              const links = plan.id === "FREE" ? undefined : planLinks[plan.id];
              const ctaHref = plan.price > 0 ? (links?.month ?? plan.href) : plan.href;
              return (
                <div
                  key={plan.id}
                  className={
                    plan.highlight
                      ? "rounded-2xl border-2 border-violet-500 bg-white p-6 shadow-lg shadow-violet-100 relative flex flex-col"
                      : "rounded-2xl border border-[#E9DDCB] bg-white p-6 shadow-sm flex flex-col"
                  }
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full tracking-wider uppercase">
                      {h.pricingPreview.popular}
                    </span>
                  )}
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">{p.name}</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {plan.price === 0 ? dict.pricing.priceFree : (locale === "fr" ? `${plan.price} $` : `$${plan.price}`)}
                    </span>
                    {plan.price > 0 && <span className="text-xs text-slate-400 mb-1">{h.pricingPreview.perMonth}</span>}
                  </div>
                  <p className="text-xs text-slate-500 mb-5 leading-relaxed flex-1">{p.desc}</p>
                  <a
                    href={ctaHref}
                    className={
                      plan.highlight
                        ? "block text-center py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors"
                        : "block text-center py-2.5 rounded-xl border border-[#E9DDCB] text-slate-700 font-semibold text-sm hover:bg-violet-50 transition-colors"
                    }
                  >
                    {p.cta}
                  </a>
                </div>
              );
            })}
          </div>
          <p className="text-center text-sm text-slate-400">
            {h.pricingPreview.footerPre}
            <a href={pricingHref} className="text-violet-600 hover:underline font-medium">{h.pricingPreview.footerLink}</a>
          </p>
        </div>
      </section>

      {/* ── CTA Band ── */}
      <section className="relative overflow-hidden py-20 bg-gradient-to-br from-[#19212B] via-[#1c2530] to-[#0e1a18]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-20 left-1/4 w-64 h-64 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-56 h-56 rounded-full bg-teal-400/15 blur-3xl" />
          <div className="absolute inset-0 opacity-35">
            <CanadaBrandBackdrop />
          </div>
        </div>
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-xs font-medium tracking-[0.14em] text-white/80 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D80621]" />
            {locale === "fr" ? "Plateforme SaaS d’abord canadienne" : "Canada-first SaaS platform"}
          </p>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/30">
            <ArrowRight className="w-5 h-5 text-white" />
          </div>
          <LandingBottomCta t={h.bottomCta} locale={locale} />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 border-t border-[#E9DDCB] bg-white/80">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Image src="/logo-icon.png" alt="Pulse" width={16} height={16} className="w-4 h-4 object-contain opacity-60" />
            <span className="text-sm">© {new Date().getFullYear()} Pulse Appointments</span>
          </div>
          <LandingFooterLinks t={h.footer} locale={locale} />
        </div>
      </footer>
    </div>
    </>
  );
}
