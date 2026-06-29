import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import Image from "next/image";
import Link from "next/link";
import { Globe, Smartphone, Users, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  alternates: buildAlternates("/features/online-booking"),
  title: "Online Booking Software for Canadian Service Businesses | Pulse",
  description:
    "Let clients book appointments online 24/7. Pulse gives you a free public booking page — add it to Instagram, Google, or your website. No app download required. CAD pricing.",
  openGraph: {
    title: "Online Booking Software | Pulse Appointments",
    description:
      "Free online booking page for Canadian service businesses. Works on Instagram, Google, and any website.",
  },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Features", item: "https://www.pulseappointments.com/features" },
    { "@type": "ListItem", position: 3, name: "Online Booking", item: "https://www.pulseappointments.com/features/online-booking" },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do clients need to create an account to book?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Clients book using just their name, email, and phone number. No password, no account, no app download required. The simpler the booking flow, the more bookings you get — that's why we designed it this way.",
      },
    },
    {
      "@type": "Question",
      name: "Can I embed the booking page on my existing website?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Pulse provides an embeddable booking widget you can add to any website with a single line of code. Clients book directly on your site without being redirected to a separate page. Works with Squarespace, Wix, WordPress, and any custom site.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if a client tries to book outside my working hours?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Pulse only shows your actual available slots. If you're not working on Sundays, Sunday slots don't appear. If a slot is already booked, it's removed from the calendar in real time. Clients can only book times that genuinely work for you.",
      },
    },
  ],
};

const steps = [
  {
    num: "01",
    title: "Add your services",
    desc: "Enter your service names, prices, duration, and availability. Takes about 5 minutes. No technical skills required.",
  },
  {
    num: "02",
    title: "Share your booking link",
    desc: "Put your Pulse booking link in your Instagram bio, Google Business profile, website, or email signature. Clients tap the link and book themselves.",
  },
  {
    num: "03",
    title: "You get notified, they get confirmed",
    desc: "Pulse sends you a notification and the client a confirmation email instantly. The appointment appears in your calendar. Done.",
  },
];

const features = [
  {
    icon: Globe,
    title: "Works anywhere clients find you",
    body: "Your booking page works from your Instagram bio, your Google Business listing, a link in your email, or embedded on your website. One link, everywhere.",
  },
  {
    icon: Smartphone,
    title: "Mobile-first for clients",
    body: "Clients book from their phone in under 2 minutes, no app download required. They pick a service, choose a time, and pay a deposit if required — all in one flow.",
  },
  {
    icon: Users,
    title: "Multi-staff and multi-service",
    body: "Clients can choose their preferred provider and service. Each staff member gets their own calendar and availability. No double-bookings possible.",
  },
];

const comparison = [
  { feature: "Free public booking page",         pulse: true,  jane: true,  vagaro: true,     acuity: true,     calendly: true },
  { feature: "No client account required",       pulse: true,  jane: false, vagaro: false,    acuity: true,     calendly: true },
  { feature: "Instagram bio link ready",         pulse: true,  jane: false, vagaro: true,     acuity: true,     calendly: true },
  { feature: "Google Business integration",      pulse: true,  jane: false, vagaro: true,     acuity: "Partial", calendly: "Partial" },
  { feature: "Multi-staff booking",              pulse: true,  jane: true,  vagaro: true,     acuity: true,     calendly: true },
  { feature: "CAD pricing",                      pulse: true,  jane: true,  vagaro: false,    acuity: false,    calendly: false },
];

const faqs = [
  {
    q: "Do clients need to create an account to book?",
    a: "No. Clients book using just their name, email, and phone number. No password, no account, no app download required. The simpler the booking flow, the more bookings you get — that's why we designed it this way.",
  },
  {
    q: "Can I embed the booking page on my existing website?",
    a: "Yes. Pulse provides an embeddable booking widget you can add to any website with a single line of code. Clients book directly on your site without being redirected to a separate page. Works with Squarespace, Wix, WordPress, and any custom site.",
  },
  {
    q: "What happens if a client tries to book outside my working hours?",
    a: "Pulse only shows your actual available slots. If you're not working on Sundays, Sunday slots don't appear. If a slot is already booked, it's removed from the calendar in real time. Clients can only book times that genuinely work for you.",
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="text-violet-600 font-bold text-base" aria-label="Yes">✓</span>;
  if (value === false) return <span className="text-slate-300 text-base" aria-label="No">—</span>;
  return <span className="text-sm font-medium text-slate-500">{value}</span>;
}

export default function OnlineBookingPage() {
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
          <Globe className="w-4 h-4 text-violet-600" />
          Online Booking
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Let clients book appointments online,{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600">
            24/7
          </span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
          No more phone tag. No more DMs asking &quot;are you free Thursday?&quot; Pulse gives you a free public booking page your clients can use any time — from Instagram, Google, or your website.
        </p>
        <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200">
          Get started free
        </Link>
        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {["Free on all plans", "No app download for clients", "Live in under 5 minutes"].map((t) => (
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
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">Up and running in minutes</h2>
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
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">One booking page. Every channel.</h2>
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
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">Online booking comparison</h2>
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
          <h2 className="text-2xl font-bold text-white mb-3">Start taking online bookings today</h2>
          <p className="text-white/60 mb-8">Your booking page is live in under 5 minutes. Free to start — no credit card required.</p>
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
