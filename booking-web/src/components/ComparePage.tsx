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
  features, pricingComparison, urgencyBanner,
}: ComparePageProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="Pulse" className="w-7 h-7 object-contain" />
            <span className="text-lg font-bold text-slate-900">Pulse Appointments</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-slate-600 hover:text-violet-600 hidden sm:block">Pricing</Link>
            <Link href="/migrate" className="text-sm text-slate-600 hover:text-violet-600 hidden sm:block">Free Migration</Link>
            <Link href="/register" className="text-sm font-semibold bg-violet-600 text-white rounded-lg px-4 py-1.5 hover:bg-violet-700 transition-colors">
              Try free →
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">

        {/* Urgency banner (Jane forced payment etc.) */}
        {urgencyBanner && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-4">
            <span className="text-2xl shrink-0">{urgencyBanner.icon}</span>
            <div>
              <p className="text-sm font-bold text-amber-900">{urgencyBanner.title}</p>
              <p className="text-sm text-amber-800 mt-1">{urgencyBanner.body}</p>
              <Link
                href="/migrate"
                className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-amber-900 underline hover:no-underline"
              >
                Switch to Pulse — free migration in 48h <ArrowRight className="w-3.5 h-3.5" />
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
              Start free — no credit card
            </Link>
            <Link
              href="/migrate"
              className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 font-semibold text-sm rounded-xl px-6 py-2.5 hover:bg-slate-50 transition-colors"
            >
              <Truck className="w-4 h-4" /> Free migration from {competitor}
            </Link>
          </div>
        </div>

        {/* Wins/losses */}
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="text-base font-semibold text-emerald-800 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Where Pulse wins
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
            <h2 className="text-base font-semibold text-slate-600 mb-3">Where {competitor} wins</h2>
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
          <h2 className="text-lg font-bold text-slate-900 mb-5 text-center">Pricing — side by side</h2>
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
            <div className="p-4">Feature</div>
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
              <p className="font-bold text-lg">Switch from {competitor}? We move you for free.</p>
              <p className="text-violet-200 text-sm mt-1">
                Client list, service menu, staff profiles — migrated in 48 hours. No tech skills needed.
              </p>
            </div>
          </div>
          <Link
            href="/migrate"
            className="shrink-0 bg-white text-violet-700 font-bold text-sm px-6 py-3 rounded-xl hover:bg-violet-50 transition-colors whitespace-nowrap"
          >
            Request free migration
          </Link>
        </div>

        {/* Bottom CTA */}
        <div className="text-center space-y-4 py-4">
          <h2 className="text-2xl font-bold text-slate-900">Ready to try Pulse?</h2>
          <p className="text-slate-500 text-base">
            Free plan with no time limit. CAD pricing. No credit card required.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-violet-600 text-white font-semibold text-base rounded-xl px-8 py-3.5 hover:bg-violet-700 transition-colors"
          >
            Get started free →
          </Link>
          <p className="text-xs text-slate-400">Setup in under 5 minutes · Cancel anytime</p>
        </div>

      </div>

      <footer className="border-t border-slate-100 bg-slate-50 mt-4">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-slate-700">Pulse Appointments</Link>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <Link href="/pricing"       className="hover:text-violet-600">Pricing</Link>
            <Link href="/compare"       className="hover:text-violet-600">Compare</Link>
            <Link href="/migrate"       className="hover:text-violet-600">Free Migration</Link>
            <Link href="/security"      className="hover:text-violet-600">Security</Link>
            <Link href="/canadian-privacy" className="hover:text-violet-600">Canadian Privacy</Link>
            <Link href="/privacy"       className="hover:text-violet-600">Privacy</Link>
            <Link href="/terms"         className="hover:text-violet-600">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
