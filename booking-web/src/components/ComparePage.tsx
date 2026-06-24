import Link from "next/link";
import { Check, X, ShieldCheck } from "lucide-react";

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
}

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="w-5 h-5 text-green-600 mx-auto" />;
  if (value === false) return <X className="w-5 h-5 text-red-400 mx-auto" />;
  return <span className="text-xs text-slate-600">{value}</span>;
}

export function ComparePage({ competitor, tagline, summary, pulseWins, theyWin, features, pricingComparison }: ComparePageProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="Pulse" className="w-7 h-7 object-contain" />
            <span className="text-lg font-bold text-slate-900">Pulse</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-slate-600 hover:text-violet-600 hidden sm:block">Pricing</Link>
            <Link href="/login" className="text-sm text-slate-600 hover:text-violet-600 hidden sm:block">Sign in</Link>
            <Link href="/register" className="text-sm font-semibold bg-violet-600 text-white rounded-lg px-4 py-1.5 hover:bg-violet-700 transition-colors">Get started free</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-violet-600 mb-2">{tagline}</p>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Pulse vs. {competitor}</h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">{summary}</p>
        </div>

        {/* Wins/losses */}
        <div className="grid sm:grid-cols-2 gap-6 mb-12">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
            <h2 className="text-base font-semibold text-green-800 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Where Pulse wins
            </h2>
            <ul className="space-y-2">
              {pulseWins.map((w) => (
                <li key={w} className="flex items-start gap-2 text-sm text-green-800">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-base font-semibold text-slate-700 mb-3">Where {competitor} wins</h2>
            <ul className="space-y-2">
              {theyWin.map((w) => (
                <li key={w} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" /> {w}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Feature table */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden mb-12">
          <div className="grid grid-cols-3 bg-slate-800 text-white text-sm font-semibold">
            <div className="p-4">Feature</div>
            <div className="p-4 text-center border-l border-slate-700 text-violet-300">Pulse</div>
            <div className="p-4 text-center border-l border-slate-700">{competitor}</div>
          </div>
          <div className="divide-y divide-slate-100">
            {features.map((f) => (
              <div key={f.feature} className={`grid grid-cols-3 text-sm ${f.highlight ? "bg-violet-50" : "bg-white"}`}>
                <div className="p-4 text-slate-700 font-medium">{f.feature}</div>
                <div className="p-4 text-center border-l border-slate-100"><Cell value={f.pulse} /></div>
                <div className="p-4 text-center border-l border-slate-100"><Cell value={f.them} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="rounded-2xl border border-slate-200 p-6 mb-12">
          <h2 className="text-lg font-bold text-slate-900 mb-4 text-center">Pricing comparison</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border-2 border-violet-500 bg-violet-50 p-5 text-center">
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-1">Pulse</p>
              <p className="text-3xl font-bold text-slate-900">{pricingComparison.pulsePrice}</p>
              <p className="text-xs text-violet-700 mt-1">{pricingComparison.pulseLabel}</p>
              <p className="text-xs text-violet-600 mt-1">{pricingComparison.pulseCurrency}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{competitor}</p>
              <p className="text-3xl font-bold text-slate-700">{pricingComparison.themPrice}</p>
              <p className="text-xs text-slate-500 mt-1">{pricingComparison.themLabel}</p>
              <p className="text-xs text-slate-500 mt-1">{pricingComparison.themCurrency}</p>
              {pricingComparison.themNote && <p className="text-xs text-amber-700 mt-1">{pricingComparison.themNote}</p>}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Try Pulse free — no credit card required</h2>
          <p className="text-slate-500 mb-6 text-base">Set up in under 5 minutes. CAD pricing. No contracts.</p>
          <Link href="/register" className="inline-block bg-violet-600 text-white font-semibold text-base rounded-xl px-8 py-3.5 hover:bg-violet-700 transition-colors">
            Get started free →
          </Link>
        </div>
      </div>

      <footer className="border-t border-slate-100 bg-slate-50 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-slate-700">Pulse Appointments</Link>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <Link href="/pricing" className="hover:text-violet-600">Pricing</Link>
            <Link href="/security" className="hover:text-violet-600">Security</Link>
            <Link href="/canadian-privacy" className="hover:text-violet-600">Canadian Privacy</Link>
            <Link href="/privacy" className="hover:text-violet-600">Privacy</Link>
            <Link href="/terms" className="hover:text-violet-600">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
