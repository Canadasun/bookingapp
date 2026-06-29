import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Clock, BarChart3, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "No-Show Protection for Canadian Service Businesses | Pulse",
  description:
    "Automatically charge no-show and late cancellation fees to card-on-file. Pulse enforces your cancellation policy so you never have to have an awkward conversation again.",
  openGraph: {
    title: "No-Show Protection Software | Pulse Appointments",
    description:
      "Automatic no-show fee charging for Canadian salons, spas, and service businesses.",
  },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Features", item: "https://www.pulseappointments.com/features" },
    { "@type": "ListItem", position: 3, name: "No-Show Protection", item: "https://www.pulseappointments.com/features/no-show-protection" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What if a client claims they didn't know about the cancellation policy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every client sees and agrees to your cancellation policy when they book — it's displayed on the booking page and included in their confirmation email. This written agreement is your protection. Clients who claim ignorance are contradicted by the booking record.",
      },
    },
    {
      "@type": "Question",
      name: "Can I waive a no-show fee for a specific client?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. You can cancel or refund any automatically charged fee from your dashboard. The system charges automatically, but you always have the final say. Some businesses waive the first offence and charge from the second.",
      },
    },
    {
      "@type": "Question",
      name: "Does no-show protection work for in-person and online bookings?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It works for all bookings made through Pulse — whether clients book through your public booking page, your Instagram bio link, or a booking link you send them directly. Walk-in bookings entered manually by you can also have card-on-file added at the time of the appointment.",
      },
    },
  ],
};

const steps = [
  {
    num: "01",
    title: "Set your cancellation policy",
    desc: "Choose your cancellation window (e.g. 24 hours) and fee amount (flat fee or percentage). Pulse shows the policy to every client before they confirm a booking.",
  },
  {
    num: "02",
    title: "Client agrees at booking",
    desc: "By completing their booking, the client agrees to your cancellation policy. Their card is stored securely by Stripe. No surprises later.",
  },
  {
    num: "03",
    title: "Fee charged automatically",
    desc: "If a client no-shows or cancels inside your policy window, Pulse charges the fee automatically and sends both of you a receipt. You don't have to do anything.",
  },
];

const features = [
  {
    icon: ShieldCheck,
    title: "Policy enforcement without confrontation",
    body: "You set the rules once. Pulse enforces them automatically. No chasing clients, no uncomfortable calls, no letting people off the hook because you felt awkward asking.",
  },
  {
    icon: Clock,
    title: "Customizable cancellation window",
    body: "Set your policy to trigger at 24 hours, 48 hours, or any window that suits your business. Late-cancel fees and no-show fees can be set independently.",
  },
  {
    icon: BarChart3,
    title: "Revenue Protected — see your real savings",
    body: "Your Revenue Protected dashboard shows exactly how much Pulse has recovered for you. Most businesses recover their entire monthly subscription cost in the first week.",
  },
];

const comparison = [
  { feature: "Cancellation policy enforcement",    pulse: true,     jane: "Partial", vagaro: true,     acuity: true,     calendly: false },
  { feature: "Automatic charge to card-on-file",   pulse: true,     jane: "Partial", vagaro: true,     acuity: false,    calendly: false },
  { feature: "No-show fee separate from deposit",  pulse: true,     jane: false,     vagaro: true,     acuity: false,    calendly: false },
  { feature: "Client agrees to policy at booking", pulse: true,     jane: true,      vagaro: true,     acuity: true,     calendly: false },
  { feature: "CAD pricing",                        pulse: true,     jane: true,      vagaro: false,    acuity: false,    calendly: false },
  { feature: "Revenue Protected dashboard",        pulse: true,     jane: false,     vagaro: false,    acuity: false,    calendly: false },
];

const faqs = [
  {
    q: "What if a client claims they didn't know about the cancellation policy?",
    a: "Every client sees and agrees to your cancellation policy when they book — it's displayed on the booking page and included in their confirmation email. This written agreement is your protection. Clients who claim ignorance are contradicted by the booking record.",
  },
  {
    q: "Can I waive a no-show fee for a specific client?",
    a: "Yes. You can cancel or refund any automatically charged fee from your dashboard. The system charges automatically, but you always have the final say. Some businesses waive the first offence and charge from the second.",
  },
  {
    q: "Does no-show protection work for in-person and online bookings?",
    a: "It works for all bookings made through Pulse — whether clients book through your public booking page, your Instagram bio link, or a booking link you send them directly. Walk-in bookings entered manually by you can also have card-on-file added at the time of the appointment.",
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="text-violet-600 font-bold text-base" aria-label="Yes">✓</span>;
  if (value === false) return <span className="text-slate-300 text-base" aria-label="No">—</span>;
  return <span className="text-sm font-medium text-slate-500">{value}</span>;
}

export default function NoShowProtectionPage() {
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
          No-Show Protection
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Charge no-show fees automatically —{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600">
            no awkward conversations
          </span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Pulse enforces your cancellation policy for you. When a client no-shows or cancels last minute, the fee is charged to their card on file automatically. You get a notification. They get a receipt. No conversation needed.
        </p>
        <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200">
          Get started free
        </Link>
        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {["Works for salons, spas, barbers, and more", "CAD pricing", "Free to start"].map((t) => (
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
              <div key={num} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm">
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
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">Protection that works while you work</h2>
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
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">No-show protection comparison</h2>
          <div className="overflow-x-auto rounded-2xl border border-[#E9DDCB] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E9DDCB]">
                  <th className="text-left px-6 py-4 font-semibold text-slate-900 w-[35%]">Feature</th>
                  <th className="px-4 py-4 font-bold text-violet-700 text-center">Pulse</th>
                  <th className="px-4 py-4 font-semibold text-slate-600 text-center">Jane App</th>
                  <th className="px-4 py-4 font-semibold text-slate-600 text-center">Vagaro</th>
                  <th className="px-4 py-4 font-semibold text-slate-600 text-center">Acuity</th>
                  <th className="px-4 py-4 font-semibold text-slate-600 text-center">Calendly</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                    <td className="px-6 py-3.5 text-slate-700">{row.feature}</td>
                    <td className="px-4 py-3.5 text-center bg-violet-50/40"><Cell value={row.pulse} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.jane} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.vagaro} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.acuity} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.calendly} /></td>
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
          <h2 className="text-2xl font-bold text-white mb-3">Stop absorbing the cost of no-shows</h2>
          <p className="text-white/60 mb-8">Set up no-show protection in under 5 minutes. Free to start — no credit card required.</p>
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
