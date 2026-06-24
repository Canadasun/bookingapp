import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { PLAN_DEFS, PLAN_FEATURES } from "@/lib/plans";
import type { FeatureValue } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing — Pulse Appointments",
  description:
    "Simple, transparent pricing for independent professionals and growing teams. Start free, upgrade when you need it.",
  openGraph: {
    title: "Pricing — Pulse Appointments",
    description: "Start free, upgrade when you need SMS reminders, deposits, and no-show protection.",
  },
};

function Cell({ value }: { value: FeatureValue }) {
  if (value === true)  return <span className="text-violet-600 font-bold text-base" aria-label="Included">✓</span>;
  if (value === false) return <span className="text-slate-300 text-base" aria-label="Not included">—</span>;
  return <span className="text-sm font-semibold text-slate-700">{value}</span>;
}

export default function PricingPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-[#E9DDCB] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-slate-900 tracking-tight">Pulse Booking</span>
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Start free. Upgrade only when you need deposits, SMS reminders, or no-show protection.
            No contracts. Cancel anytime.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {PLAN_DEFS.map((plan) => (
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
                  Most popular
                </span>
              )}
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">{plan.name}</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                  {plan.price === 0 ? "Free" : `$${plan.price}`}
                </span>
                {plan.price > 0 && (
                  <span className="text-sm text-slate-400 mb-1.5">{plan.period}</span>
                )}
              </div>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">{plan.desc}</p>
              <Link
                href={plan.href}
                className={
                  plan.highlight
                    ? "flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors"
                    : "flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#E9DDCB] bg-white text-slate-800 font-semibold text-sm hover:bg-violet-50 transition-colors"
                }
              >
                {plan.highlight && <Sparkles className="h-4 w-4" />}
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Feature table */}
        <div className="overflow-x-auto rounded-3xl border border-[#E9DDCB] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E9DDCB]">
                <th className="text-left px-6 py-4 font-semibold text-slate-900 w-[40%]">Feature</th>
                {PLAN_DEFS.map((p) => (
                  <th
                    key={p.id}
                    className={
                      p.highlight
                        ? "px-4 py-4 font-bold text-violet-700 text-center"
                        : "px-4 py-4 font-semibold text-slate-700 text-center"
                    }
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_FEATURES.map((f, i) => (
                <tr
                  key={f.label}
                  className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
                >
                  <td className="px-6 py-3.5 text-slate-700">{f.label}</td>
                  <td className="px-4 py-3.5 text-center"><Cell value={f.free} /></td>
                  <td className="px-4 py-3.5 text-center"><Cell value={f.basic} /></td>
                  <td className="px-4 py-3.5 text-center bg-violet-50/40"><Cell value={f.pro} /></td>
                  <td className="px-4 py-3.5 text-center"><Cell value={f.unlimited} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 px-6 py-3 border-t border-[#E9DDCB]">
            * 1/mo — one automatic fee per calendar month on Free and Basic plans. Upgrade to Pro for unlimited no-show and late-cancel fees.
          </p>
        </div>

        {/* FAQ / reassurance */}
        <div className="mt-16 grid sm:grid-cols-3 gap-8 text-center">
          {[
            { q: "Is there a free trial?", a: "The Free plan has no time limit. Use it forever, then upgrade when you're ready." },
            { q: "Can I cancel anytime?", a: "Yes. Downgrade or cancel from your account settings at any time. No cancellation fees." },
            { q: "What payment methods do you accept?", a: "All major credit and debit cards, Apple Pay, and Google Pay via Stripe. Payments are in CAD." },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-2xl border border-[#E9DDCB] bg-white p-6">
              <p className="font-bold text-slate-900 mb-2">{q}</p>
              <p className="text-sm text-slate-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-3xl bg-[#19212B] p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to get started?</h2>
          <p className="text-white/60 mb-8">Create your free account in under 2 minutes. No credit card required.</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-8 py-4 rounded-xl hover:bg-violet-50 transition-colors"
          >
            <Sparkles className="h-5 w-5" /> Get started free
          </Link>
          <p className="mt-4 text-xs text-white/40">
            Questions?{" "}
            <Link href="/support" className="underline hover:text-white/70 transition-colors">
              Visit our support page
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E9DDCB] bg-white/80 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-slate-400">© {new Date().getFullYear()} Pulse Appointments</span>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-indigo-600 transition-colors">Home</Link>
            <Link href="/terms" className="hover:text-indigo-600 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-indigo-600 transition-colors">Privacy</Link>
            <Link href="/support" className="hover:text-indigo-600 transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
