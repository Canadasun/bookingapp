import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import Link from "next/link";
import { Bell, ClipboardList, CreditCard, MapPin, MessageSquare, ShieldCheck, Star, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Appointment Booking Features | Pulse Appointments",
  description: "Explore Pulse features for Canadian service businesses: online booking, deposits, no-show protection, SMS reminders, intake forms, client management, multi-location, and reviews.",
  alternates: buildAlternates("/features"),
  openGraph: {
    title: "Pulse Appointment Booking Features",
    description: "Online booking, reminders, deposits, reviews, intake forms, and client management for Canadian service businesses.",
    url: "https://www.pulseappointments.com/features",
  },
};

const features = [
  {
    href: "/features/online-booking",
    icon: CreditCard,
    title: "Online booking",
    desc: "Let clients book 24/7 from Instagram, Google, or your website.",
  },
  {
    href: "/features/deposits",
    icon: ShieldCheck,
    title: "Booking deposits",
    desc: "Collect deposits during booking and protect high-value appointments.",
  },
  {
    href: "/features/no-show-protection",
    icon: ShieldCheck,
    title: "No-show protection",
    desc: "Use policies and card-on-file workflows to reduce lost revenue.",
  },
  {
    href: "/features/sms-reminders",
    icon: Bell,
    title: "SMS reminders",
    desc: "Send appointment reminders so clients remember upcoming visits.",
  },
  {
    href: "/features/client-management",
    icon: Users,
    title: "Client management",
    desc: "Keep client records, notes, appointments, and history together.",
  },
  {
    href: "/features/intake-forms",
    icon: ClipboardList,
    title: "Intake forms",
    desc: "Collect allergies, preferences, consent details, and custom answers.",
  },
  {
    href: "/features/multi-location",
    icon: MapPin,
    title: "Multi-location",
    desc: "Organize services, staff, and booking paths across multiple locations.",
  },
  {
    href: "/features/reviews",
    icon: Star,
    title: "Reviews",
    desc: "Collect and publish review proof tied to completed appointments.",
  },
];

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Features", item: "https://www.pulseappointments.com/features" },
  ],
};

const collectionSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Pulse Appointment Booking Features",
  url: "https://www.pulseappointments.com/features",
  hasPart: features.map((feature) => ({
    "@type": "WebPage",
    name: feature.title,
    url: `https://www.pulseappointments.com${feature.href}`,
  })),
};

export default function FeaturesPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF] text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbSchema, collectionSchema]) }} />
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Features</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Appointment booking features for Canadian service businesses
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Pulse brings booking, reminders, deposits, client records, intake forms, multi-location scheduling, and review collection into one service-business platform.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex items-center justify-center rounded-lg bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800">
              Start free
            </Link>
            <Link href="/demo" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              View demo
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-[#E9DDCB] bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ href, icon: Icon, title, desc }) => (
            <Link key={href} href={href} className="group rounded-lg border border-slate-200 p-5 transition-colors hover:border-violet-300 hover:bg-violet-50/40">
              <Icon className="h-5 w-5 text-violet-700" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold text-slate-950 group-hover:text-violet-800">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-lg border border-[#E9DDCB] bg-white p-6">
          <MessageSquare className="h-5 w-5 text-violet-700" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-slate-950">Built to work together</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            The strongest Pulse workflows combine multiple features: an intake form before booking, a deposit at checkout, SMS reminders before the appointment, and a review request after completion.
          </p>
        </div>
      </section>
    </main>
  );
}
