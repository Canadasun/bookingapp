import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CreditCard, ShieldCheck, Bell, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Appointment Booking Software for Vancouver Service Businesses | Pulse",
  description: "Pulse is the simplest online booking software for salons, spas, barbers, and wellness businesses in Vancouver. CAD pricing, no-show protection, free to start.",
  openGraph: {
    title: "Appointment Booking Software Vancouver | Pulse Appointments",
    description: "Online booking for Vancouver salons, spas, and service businesses. CAD pricing, free to start.",
  },
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Booking Software for Vancouver", item: "https://www.pulseappointments.com/for/vancouver" },
  ],
};

const features = [
  {
    icon: CreditCard,
    title: "CAD pricing, always",
    body: "No USD conversion. No monthly exchange rate surprises. Your bill is in Canadian dollars, period.",
  },
  {
    icon: ShieldCheck,
    title: "No-show protection",
    body: "Vancouver's service market is competitive. Protect every slot with deposits and automatic no-show charges — without a single awkward conversation.",
  },
  {
    icon: Bell,
    title: "Automated reminders",
    body: "Email and SMS reminders before every appointment. Built for Vancouver's busy clients who book weeks in advance.",
  },
];

const niches = [
  { label: "Hair Salons", href: "/for/salons" },
  { label: "Barber Shops", href: "/for/barbers" },
  { label: "Spas", href: "/for/spas" },
  { label: "Lash Studios", href: "/for/lash-techs" },
  { label: "Nail Salons", href: "/for/nail-techs" },
  { label: "Massage Therapy", href: "/for/massage-therapists" },
  { label: "Estheticians", href: "/for/estheticians" },
  { label: "Wellness Studios", href: "/for/wellness" },
  { label: "Pet Groomers", href: "/for/pet-groomers" },
  { label: "Mobile Services", href: "/for/mobile-services" },
];

const plans = [
  { name: "Free", price: "$0" },
  { name: "Basic", price: "$19" },
  { name: "Pro", price: "$39" },
  { name: "Unlimited", price: "$79" },
];

export default function VancouverPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

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
          <CheckCircle2 className="w-4 h-4 text-violet-600" />
          Built for Canadian service businesses
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Online booking software for{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600">
            Vancouver service businesses
          </span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Built for Vancouver salons, spas, barbers, lash artists, massage therapists, and wellness professionals. CAD pricing. No USD surprises. Free to start.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200">
            Get started free
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-400">No credit card required · Cancel anytime</p>
      </section>

      {/* Why Vancouver businesses choose Pulse */}
      <section className="py-16 bg-white/60 border-y border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">Why Vancouver businesses choose Pulse</h2>
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

      {/* Works for every Vancouver service business */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Works for every Vancouver service business</h2>
          <p className="text-slate-500 mb-10">From Kitsilano studios to North Shore shops — Pulse fits any appointment-based service.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {niches.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="px-4 py-2 bg-white rounded-full border border-[#E9DDCB] text-sm font-medium text-slate-700 hover:border-violet-400 hover:text-violet-700 transition-colors shadow-sm"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-16 bg-white/60 border-t border-[#E9DDCB]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Start free — upgrade when you need it</h2>
          <p className="text-slate-500 mb-10">No contracts. No credit card required. Cancel anytime.</p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {plans.map(({ name, price }) => (
              <div key={name} className="bg-white rounded-2xl border border-[#E9DDCB] px-6 py-4 shadow-sm text-center min-w-[110px]">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">{name}</p>
                <p className="text-2xl font-extrabold text-slate-900">{price}</p>
                {price !== "$0" && <p className="text-xs text-slate-400">/mo CAD</p>}
              </div>
            ))}
          </div>
          <Link href="/pricing" className="text-sm text-violet-600 hover:underline font-medium">
            See full feature breakdown →
          </Link>
        </div>
      </section>

      {/* CTA band */}
      <section className="py-20 bg-[#19212B]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Start taking Vancouver bookings today</h2>
          <p className="text-white/60 mb-8">Create your free account in 2 minutes. No credit card required.</p>
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
          </div>
        </div>
      </footer>
    </main>
  );
}
