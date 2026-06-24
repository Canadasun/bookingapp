import Link from "next/link";
import { Check, ShieldCheck, Star } from "lucide-react";
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
  testimonial?: { quote: string; name: string; city: string };
  ctaLabel?: string;
}

export function IndustryPage({
  headline,
  subheadline,
  heroEmoji,
  features,
  checklist,
  testimonial,
  ctaLabel = "Start free — no credit card required",
}: IndustryPageProps) {
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

      {/* Hero */}
      <div className="bg-gradient-to-b from-violet-50 to-white">
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="text-6xl mb-6">{heroEmoji}</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 leading-tight">{headline}</h1>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">{subheadline}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white font-semibold text-base rounded-xl px-6 py-3.5 hover:bg-violet-700 transition-colors">
              {ctaLabel}
            </Link>
            <Link href="/pricing" className="inline-flex items-center justify-center bg-white border border-slate-200 text-slate-700 font-semibold text-base rounded-xl px-6 py-3.5 hover:border-violet-300 transition-colors">
              See pricing →
            </Link>
          </div>
          <p className="text-xs text-slate-400 mt-4">CAD pricing · No contracts · Cancel anytime</p>
        </div>
      </div>

      {/* Trust bar */}
      <div className="border-y border-slate-100 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-600" /> No-show protection</span>
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-violet-600" /> Online deposits</span>
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-violet-600" /> SMS reminders</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-600" /> PIPEDA-aware</span>
          <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-violet-600" /> 🇨🇦 CAD pricing</span>
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
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Everything you need, out of the box</h2>
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

      {/* Testimonial */}
      {testimonial && (
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <div className="flex justify-center mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
            ))}
          </div>
          <blockquote className="text-xl font-medium text-slate-800 mb-4 leading-relaxed">
            &ldquo;{testimonial.quote}&rdquo;
          </blockquote>
          <p className="text-sm text-slate-500">{testimonial.name} · {testimonial.city}</p>
        </div>
      )}

      {/* Canada callout */}
      <div className="bg-violet-600">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center text-white">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-200 mb-2">🇨🇦 Built for Canada</p>
          <h2 className="text-2xl font-bold mb-3">Prices in CAD. GST/HST built in. PIPEDA-aware.</h2>
          <p className="text-violet-100 text-base mb-6 max-w-xl mx-auto">No currency conversion surprises. Tax fields included. Privacy practices aligned with Canadian law.</p>
          <Link href="/register" className="inline-block bg-white text-violet-700 font-semibold text-base rounded-xl px-6 py-3 hover:bg-violet-50 transition-colors">
            Start free today →
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-slate-700">Pulse Appointments</Link>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <Link href="/pricing" className="hover:text-violet-600">Pricing</Link>
            <Link href="/security" className="hover:text-violet-600">Security</Link>
            <Link href="/canadian-privacy" className="hover:text-violet-600">Canadian Privacy</Link>
            <Link href="/privacy" className="hover:text-violet-600">Privacy</Link>
            <Link href="/terms" className="hover:text-violet-600">Terms</Link>
            <Link href="/support" className="hover:text-violet-600">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
