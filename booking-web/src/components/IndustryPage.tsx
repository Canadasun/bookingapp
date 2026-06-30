import Link from "next/link";
import Image from "next/image";
import { Check, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface IndustryFeature {
  icon: LucideIcon;
  title: string;
  body: string;
}

export interface IndustryPageProps {
  title: string;
  headline: string;
  subheadline: string;
  heroEmoji: string;
  features: IndustryFeature[];
  checklist: string[];
  ctaLabel?: string;
  locale?: "en" | "fr";
}

export function IndustryPage({
  headline,
  subheadline,
  heroEmoji,
  features,
  checklist,
  ctaLabel,
  locale = "en",
}: IndustryPageProps) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const pricingHref = fr ? "/fr/pricing" : "/pricing";
  const securityHref = fr ? "/fr/security" : "/security";
  const canadianPrivacyHref = fr ? "/fr/canadian-privacy" : "/canadian-privacy";
  const privacyHref = fr ? "/fr/privacy" : "/privacy";
  const termsHref = fr ? "/fr/terms" : "/terms";
  const cta = ctaLabel ?? (fr ? "Commencez gratuitement — aucune carte de crédit requise" : "Start free — no credit card required");
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href={home} className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="Pulse" width={28} height={28} className="w-7 h-7 object-contain" />
            <span className="text-lg font-bold text-slate-900">Pulse</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href={pricingHref} className="text-sm text-slate-600 hover:text-violet-600 hidden sm:block">{fr ? "Tarifs" : "Pricing"}</Link>
            <Link href={`/login${fr ? "?lang=fr" : ""}`} className="text-sm text-slate-600 hover:text-violet-600 hidden sm:block">{fr ? "Se connecter" : "Sign in"}</Link>
            <Link href={`/register${fr ? "?lang=fr" : ""}`} className="text-sm font-semibold bg-violet-600 text-white rounded-lg px-4 py-1.5 hover:bg-violet-700 transition-colors">{fr ? "Commencer gratuitement" : "Get started free"}</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-b from-violet-50 to-white">
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="text-6xl mb-6" aria-hidden="true">{heroEmoji}</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 leading-tight">{headline}</h1>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">{subheadline}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/register${fr ? "?lang=fr" : ""}`} className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white font-semibold text-base rounded-xl px-6 py-3.5 hover:bg-violet-700 transition-colors">
              {cta}
            </Link>
            <Link href={pricingHref} className="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-700 font-semibold text-base rounded-xl px-6 py-3.5 hover:border-violet-300 transition-colors">
              {fr ? "Voir les tarifs →" : "See pricing →"}
            </Link>
          </div>
          <p className="text-xs text-slate-400 mt-4">{fr ? "Prix en CAD · Sans contrat · Annulez à tout moment" : "CAD pricing · No contracts · Cancel anytime"}</p>
        </div>
      </div>

      {/* Trust bar */}
      <div className="border-y border-slate-100 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-600" /> {fr ? "Protection contre les absences" : "No-show protection"}</span>
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-violet-600" /> {fr ? "Acomptes en ligne" : "Online deposits"}</span>
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-violet-600" /> {fr ? "Rappels par SMS" : "SMS reminders"}</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-600" /> {fr ? "Conforme à la LPRPDE" : "PIPEDA-aware"}</span>
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-violet-600" /> <span aria-hidden="true">🇨🇦</span> {fr ? "Prix en CAD" : "CAD pricing"}</span>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="grid sm:grid-cols-3 gap-8">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-violet-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">{fr ? "Tout ce qu’il vous faut, dès le départ" : "Everything you need, out of the box"}</h2>
          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {checklist.map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
                <p className="text-sm text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Verifiable trust foundation */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-3">{fr ? "Fondement de confiance" : "Trust foundation"}</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">{fr ? "Bâti sur des signaux vérifiables, pas de faux témoignages" : "Built around verifiable signals, not placeholder testimonials"}</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            {fr
              ? "Pulse utilise de vraies demandes d’avis après les rendez-vous terminés, des badges d’entreprise vérifiée pour les entreprises dont l’identité a été confirmée, ainsi que des pages publiques de sécurité et de confidentialité afin que les clients puissent évaluer l’expérience de réservation avant de s’engager."
              : "Pulse uses real review requests after completed appointments, verified-business badges for identity-checked businesses, and public security and privacy pages so clients can evaluate the booking experience before they commit."}
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: fr ? "Sécurité" : "Security", href: securityHref },
              { label: fr ? "Vie privée au Canada" : "Canadian Privacy", href: canadianPrivacyHref },
              { label: fr ? "Journal des modifications" : "Changelog", href: "/changelog" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Canada callout */}
      <div className="bg-violet-600">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center text-white">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-200 mb-2"><span aria-hidden="true">🇨🇦</span> {fr ? "Conçu pour le Canada" : "Built for Canada"}</p>
          <h2 className="text-2xl font-bold mb-3">{fr ? "Prix en CAD. TPS/TVH intégrées. Conforme à la LPRPDE." : "Prices in CAD. GST/HST built in. PIPEDA-aware."}</h2>
          <p className="text-violet-100 text-base mb-6 max-w-xl mx-auto">{fr ? "Aucune surprise de conversion de devises. Champs de taxes inclus. Pratiques de confidentialité alignées sur le droit canadien." : "No currency conversion surprises. Tax fields included. Privacy practices aligned with Canadian law."}</p>
          <Link href={`/register${fr ? "?lang=fr" : ""}`} className="inline-block bg-white text-violet-700 font-semibold text-base rounded-xl px-6 py-3 hover:bg-violet-50 transition-colors">
            {fr ? "Commencez gratuitement aujourd’hui →" : "Start free today →"}
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href={home} className="text-sm font-semibold text-slate-700">Pulse Appointments</Link>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <Link href={pricingHref} className="hover:text-violet-600">{fr ? "Tarifs" : "Pricing"}</Link>
            <Link href={securityHref} className="hover:text-violet-600">{fr ? "Sécurité" : "Security"}</Link>
            <Link href={canadianPrivacyHref} className="hover:text-violet-600">{fr ? "Vie privée au Canada" : "Canadian Privacy"}</Link>
            <Link href={privacyHref} className="hover:text-violet-600">{fr ? "Confidentialité" : "Privacy"}</Link>
            <Link href={termsHref} className="hover:text-violet-600">{fr ? "Conditions" : "Terms"}</Link>
            <Link href={fr ? "/fr/support" : "/support"} className="hover:text-violet-600">{fr ? "Soutien" : "Support"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
