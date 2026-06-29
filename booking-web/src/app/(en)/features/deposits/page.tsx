import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, CreditCard, BarChart3, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  alternates: buildAlternates("/features/deposits"),
  title: "Booking Deposit Software for Canadian Service Businesses | Pulse",
  description:
    "Require a deposit when clients book online. Pulse automatically collects and holds deposits — and charges no-show fees to card-on-file. CAD pricing, free to start.",
  openGraph: {
    title: "Booking Deposit Software | Pulse Appointments",
    description:
      "Collect deposits at booking. Charge no-shows automatically. Built for Canadian service businesses.",
  },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Features", item: "https://www.pulseappointments.com/features" },
    { "@type": "ListItem", position: 3, name: "Booking Deposits", item: "https://www.pulseappointments.com/features/deposits" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What happens if a client disputes the deposit charge?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stripe's built-in dispute process handles chargebacks. Pulse provides a record of the deposit policy the client agreed to at booking — this is the most important evidence in a dispute. Chargeback rates for deposits with clear upfront policies are very low.",
      },
    },
    {
      "@type": "Question",
      name: "Can I refund a deposit if a client cancels with enough notice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can refund deposits manually from your Pulse dashboard at any time. If a client cancels within your free-cancellation window, you can refund the deposit in one click. Pulse doesn't refund automatically — you stay in control.",
      },
    },
    {
      "@type": "Question",
      name: "Do clients need to create an account to pay a deposit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Clients pay the deposit as part of the booking flow using any credit or debit card, Apple Pay, or Google Pay. No account creation required. The card is stored securely by Stripe for future charges.",
      },
    },
  ],
};

const steps = [
  {
    num: "01",
    title: "Set your deposit amount",
    desc: "Choose a flat dollar amount or a percentage of the service price. Set it per-service — a colour treatment can require more than a quick trim.",
  },
  {
    num: "02",
    title: "Client pays at booking",
    desc: "When a client books online, Pulse collects the deposit through Stripe. The client sees the deposit amount and policy before confirming.",
  },
  {
    num: "03",
    title: "No-show? Charge automatically",
    desc: "If a client no-shows or cancels inside your policy window, Pulse charges the remaining balance (or the full no-show fee) to the card automatically. No awkward calls.",
  },
];

const features = [
  {
    icon: ShieldCheck,
    title: "Per-service deposit rules",
    body: "Set different deposit amounts for different services. A 3-hour colour appointment can require a $50 deposit. A 20-minute trim can have none.",
  },
  {
    icon: CreditCard,
    title: "Card-on-file for no-show fees",
    body: "After the deposit is collected, the client's card stays on file. Late cancel or no-show? The additional fee is charged automatically — you never have to ask.",
  },
  {
    icon: BarChart3,
    title: "Revenue Protected dashboard",
    body: "See exactly how much money Pulse has saved you from no-shows and cancellations. Your Revenue Protected number shows the real ROI of deposits.",
  },
];

const comparison = [
  { feature: "Deposits at booking",                 pulse: true,  acuity: true,  calendly: false, square: true },
  { feature: "No-show auto-charge beyond deposit",  pulse: true,  acuity: false, calendly: false, square: "Partial" },
  { feature: "Card-on-file for future charges",     pulse: true,  acuity: false, calendly: false, square: true },
  { feature: "CAD pricing",                         pulse: true,  acuity: false, calendly: false, square: false },
  { feature: "Revenue Protected metric",            pulse: true,  acuity: false, calendly: false, square: false },
  { feature: "Per-service deposit rules",           pulse: true,  acuity: true,  calendly: false, square: true },
];

const faqs = [
  {
    q: "What happens if a client disputes the deposit charge?",
    a: "Stripe's built-in dispute process handles chargebacks. Pulse provides a record of the deposit policy the client agreed to at booking — this is the most important evidence in a dispute. Chargeback rates for deposits with clear upfront policies are very low.",
  },
  {
    q: "Can I refund a deposit if a client cancels with enough notice?",
    a: "Yes. You can refund deposits manually from your Pulse dashboard at any time. If a client cancels within your free-cancellation window, you can refund the deposit in one click. Pulse doesn't refund automatically — you stay in control.",
  },
  {
    q: "Do clients need to create an account to pay a deposit?",
    a: "No. Clients pay the deposit as part of the booking flow using any credit or debit card, Apple Pay, or Google Pay. No account creation required. The card is stored securely by Stripe for future charges.",
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="text-violet-600 font-bold text-base" aria-label="Yes">✓</span>;
  if (value === false) return <span className="text-slate-300 text-base" aria-label="No">—</span>;
  return <span className="text-sm font-medium text-slate-500">{value}</span>;
}

export default function DepositsPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Nav */}
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

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-white border border-[#E9DDCB] text-sm font-semibold text-slate-700 px-4 py-1.5 rounded-full mb-8 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-violet-600" />
          Booking Deposits
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Require a deposit when clients book —{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600">
            automatically
          </span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Stop losing money to no-shows. Pulse collects a deposit when clients book and charges the card automatically if they don&apos;t show up. Set it up once. It runs itself.
        </p>
        <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200">
          Get started free
        </Link>
        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {["No credit card required to start", "CAD pricing", "Cancel anytime"].map((t) => (
            <div key={t} className="flex items-center gap-1.5 text-sm text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {t}
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-white/60 border-y border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map(({ num, title, desc }) => (
              <div key={num} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm relative overflow-hidden">
                <p className="text-6xl font-black mb-4 leading-none bg-gradient-to-br from-amber-400 to-orange-400 bg-clip-text text-transparent select-none">{num}</p>
                <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">Everything you need to protect your revenue</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-violet-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-16 bg-white/60 border-t border-[#E9DDCB]">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">How Pulse deposits compare</h2>
          <div className="overflow-x-auto rounded-2xl border border-[#E9DDCB] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E9DDCB]">
                  <th className="text-left px-6 py-4 font-semibold text-slate-900 w-[40%]">Feature</th>
                  <th className="px-4 py-4 font-bold text-violet-700 text-center">Pulse</th>
                  <th className="px-4 py-4 font-semibold text-slate-600 text-center">Acuity</th>
                  <th className="px-4 py-4 font-semibold text-slate-600 text-center">Calendly</th>
                  <th className="px-4 py-4 font-semibold text-slate-600 text-center">Square</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                    <td className="px-6 py-3.5 text-slate-700">{row.feature}</td>
                    <td className="px-4 py-3.5 text-center bg-violet-50/40"><Cell value={row.pulse} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.acuity} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.calendly} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.square} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
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

      {/* CTA band */}
      <section className="py-20 bg-[#19212B]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Start protecting your appointments today</h2>
          <p className="text-white/60 mb-8">Set up deposits in under 5 minutes. Free to start — no credit card required.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-8 py-4 rounded-xl hover:bg-violet-50 transition-colors">
            Get started free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E9DDCB] bg-white/80 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-slate-400">© {new Date().getFullYear()} Pulse Appointments</span>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-violet-600 transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-violet-600 transition-colors">Pricing</Link>
            <Link href="/terms" className="hover:text-violet-600 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-violet-600 transition-colors">Privacy</Link>
            <Link href="/support" className="hover:text-violet-600 transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
