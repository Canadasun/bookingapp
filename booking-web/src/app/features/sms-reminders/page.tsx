import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MessageSquare, Bell, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "SMS Appointment Reminders for Canadian Service Businesses | Pulse",
  description:
    "Automated SMS and email appointment reminders that reduce no-shows by up to 80%. Pulse sends reminders at 72h, 24h, and 2h before every appointment. CAD pricing.",
  openGraph: {
    title: "SMS Appointment Reminders | Pulse Appointments",
    description:
      "Automated SMS reminders that cut no-shows by 80%. Built for Canadian service businesses.",
  },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Features", item: "https://www.pulseappointments.com/features" },
    { "@type": "ListItem", position: 3, name: "SMS Reminders", item: "https://www.pulseappointments.com/features/sms-reminders" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What plan do I need for SMS reminders?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SMS reminders are available on the Basic plan ($19 CAD/month) and above. The Free plan includes email confirmations and updates, but not scheduled SMS or email reminders. You can upgrade at any time from your account settings.",
      },
    },
    {
      "@type": "Question",
      name: "Does Pulse handle CASL compliance for SMS automatically?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. When a client provides their phone number at booking, Pulse captures their consent to receive appointment reminders in a CASL-compliant format. You don't need to manage consent separately. Marketing messages (campaigns, win-backs) have separate consent captured under your marketing settings.",
      },
    },
    {
      "@type": "Question",
      name: "What does the reminder SMS actually say?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Pulse sends a plain-language message with the client's name, appointment date and time, service name, and your business name. It includes a link to their booking details where they can reschedule or cancel. You can customize the message template from your notification settings.",
      },
    },
  ],
};

const steps = [
  {
    num: "01",
    title: "Turn on SMS reminders",
    desc: "Enable SMS reminders in your Pulse settings. Choose which intervals to use: 72 hours, 24 hours, and 2 hours before each appointment. Takes 60 seconds to set up.",
  },
  {
    num: "02",
    title: "Clients opt in at booking",
    desc: "When a client books, they provide their phone number and consent to receive appointment reminders. CASL-compliant consent is captured automatically.",
  },
  {
    num: "03",
    title: "Reminders go out automatically",
    desc: "Pulse sends SMS messages at exactly the intervals you set. No manual work. Each message includes the appointment time, service, and a link to reschedule or cancel.",
  },
];

const features = [
  {
    icon: MessageSquare,
    title: "SMS + email, both channels",
    body: "Some clients prefer text. Some prefer email. Pulse sends both so every client gets reminded in the way they actually check. The 24h SMS is the one that stops no-shows.",
  },
  {
    icon: Bell,
    title: "Customizable reminder timing",
    body: "Use the default 72h/24h/2h schedule or adjust to what works for your business. A busy salon might want a 48h reminder. A mobile groomer might add a same-morning text.",
  },
  {
    icon: CheckCircle2,
    title: "CASL-compliant consent capture",
    body: "Canada's anti-spam law (CASL) requires consent before sending marketing or transactional messages. Pulse captures this automatically at booking — you're covered.",
  },
];

const comparison = [
  { feature: "SMS reminders included",      pulse: true,        vagaro: "Add-on", acuity: true,    square: true,    calendly: "Add-on" },
  { feature: "Email reminders included",    pulse: true,        vagaro: true,     acuity: true,    square: true,    calendly: true },
  { feature: "CASL consent capture",        pulse: true,        vagaro: false,    acuity: false,   square: false,   calendly: false },
  { feature: "Customizable timing",         pulse: true,        vagaro: true,     acuity: true,    square: "Partial", calendly: "Partial" },
  { feature: "Reschedule link in reminder", pulse: true,        vagaro: true,     acuity: true,    square: true,    calendly: true },
  { feature: "CAD pricing",                 pulse: true,        vagaro: false,    acuity: false,   square: false,   calendly: false },
];

const faqs = [
  {
    q: "What plan do I need for SMS reminders?",
    a: "SMS reminders are available on the Basic plan ($19 CAD/month) and above. The Free plan includes email confirmations and updates, but not scheduled SMS or email reminders. You can upgrade at any time from your account settings.",
  },
  {
    q: "Does Pulse handle CASL compliance for SMS automatically?",
    a: "Yes. When a client provides their phone number at booking, Pulse captures their consent to receive appointment reminders in a CASL-compliant format. You don't need to manage consent separately. Marketing messages (campaigns, win-backs) have separate consent captured under your marketing settings.",
  },
  {
    q: "What does the reminder SMS actually say?",
    a: "Pulse sends a plain-language message with the client's name, appointment date and time, service name, and your business name. It includes a link to their booking details where they can reschedule or cancel. You can customize the message template from your notification settings.",
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="text-violet-600 font-bold text-base" aria-label="Yes">✓</span>;
  if (value === false) return <span className="text-slate-300 text-base" aria-label="No">—</span>;
  return <span className="text-sm font-medium text-slate-500">{value}</span>;
}

export default function SmsRemindersPage() {
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
          <MessageSquare className="w-4 h-4 text-violet-600" />
          SMS Reminders
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Automated SMS reminders{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600">
            that actually get read
          </span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Email reminders get ignored. SMS reminders get opened. Pulse sends automated text reminders before every appointment — reducing no-shows by up to 80% without any manual work from you.
        </p>
        <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200">
          Get started free
        </Link>
        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {["SMS included on Basic+ plans", "CAD pricing", "No credit card to start"].map((t) => (
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
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">Reminders that work while you work</h2>
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
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">SMS reminder comparison</h2>
          <div className="overflow-x-auto rounded-2xl border border-[#E9DDCB] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E9DDCB]">
                  <th className="text-left px-6 py-4 font-semibold text-slate-900 w-[35%]">Feature</th>
                  <th className="px-4 py-4 font-bold text-violet-700 text-center">Pulse</th>
                  <th className="px-4 py-4 font-semibold text-slate-600 text-center">Vagaro</th>
                  <th className="px-4 py-4 font-semibold text-slate-600 text-center">Acuity</th>
                  <th className="px-4 py-4 font-semibold text-slate-600 text-center">Square</th>
                  <th className="px-4 py-4 font-semibold text-slate-600 text-center">Calendly</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                    <td className="px-6 py-3.5 text-slate-700">{row.feature}</td>
                    <td className="px-4 py-3.5 text-center bg-violet-50/40"><Cell value={row.pulse} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.vagaro} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.acuity} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={row.square} /></td>
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
          <h2 className="text-2xl font-bold text-white mb-3">Cut no-shows by up to 80% — automatically</h2>
          <p className="text-white/60 mb-8">Enable SMS reminders in under 60 seconds. Free to start — no credit card required.</p>
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
