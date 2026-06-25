import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, MapPin, ShieldCheck, Sparkles } from "lucide-react";

const SITE_URL = "https://www.pulseappointments.com";

export const metadata: Metadata = {
  title: "About Pulse Appointments | Canadian Booking Software",
  description:
    "Learn about Pulse Appointments, a Canada-first online booking platform for salons, spas, barbers, wellness providers, and appointment-based service businesses.",
  openGraph: {
    title: "About Pulse Appointments",
    description:
      "Pulse is built for Canadian service businesses that need online booking, deposits, reminders, and no-show protection.",
  },
};

const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About Pulse Appointments",
  url: `${SITE_URL}/about`,
  mainEntity: {
    "@type": "SoftwareApplication",
    name: "Pulse Appointments",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS",
    offers: { "@type": "Offer", priceCurrency: "CAD", price: "0" },
  },
};

const principles = [
  {
    icon: MapPin,
    title: "Canada-first by default",
    body: "Pulse focuses on CAD pricing, Canadian privacy expectations, GST/HST-ready invoicing, and CASL-aware communication workflows.",
  },
  {
    icon: ShieldCheck,
    title: "Trust before growth claims",
    body: "We do not publish fabricated testimonials. Public trust signals should come from real customers, verified businesses, privacy pages, and shipped product improvements.",
  },
  {
    icon: Sparkles,
    title: "Built for practical operators",
    body: "The product is designed for appointment-based teams that need booking, reminders, deposits, staff calendars, and client records without enterprise complexity.",
  },
];

export default function AboutPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }} />

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

      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-white border border-[#E9DDCB] text-sm font-semibold text-slate-700 px-4 py-1.5 rounded-full mb-8 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-violet-600" />
          About Pulse
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Booking software built for{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600">
            Canadian service businesses
          </span>
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Pulse Appointments helps salons, spas, barbers, wellness providers, consultants, and mobile service businesses take bookings online, reduce no-shows, collect deposits, and manage client relationships from one place.
        </p>
      </section>

      <section className="py-16 bg-white/60 border-y border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">What guides the product</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {principles.map(({ icon: Icon, title, body }) => (
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

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">A note on public trust</h2>
          <div className="space-y-4 text-slate-600 leading-relaxed">
            <p>
              Pulse is intentionally replacing placeholder social proof with verifiable signals: real customer reviews when available, public security documentation, Canadian privacy guidance, changelog history, and clear product pages.
            </p>
            <p>
              Founder biography and customer testimonials should be added only when the details are ready to publish accurately. That keeps the site stronger for users, search engines, and long-term brand trust.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/trust" className="inline-flex items-center justify-center bg-violet-600 text-white font-semibold px-5 py-3 rounded-xl hover:bg-violet-700 transition-colors">
              View trust center
            </Link>
            <Link href="/changelog" className="inline-flex items-center justify-center bg-white border border-[#E9DDCB] text-slate-700 font-semibold px-5 py-3 rounded-xl hover:border-violet-300 transition-colors">
              View changelog
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
