import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: buildAlternates("/for"),
  title: "Pulse for Your Industry | Canadian Booking Software",
  description: "Pulse Appointments is built for salons, barbers, lash techs, estheticians, massage therapists, pet groomers, consultants, wellness providers, and mobile services.",
};

const industries = [
  { href: "/for/salons", emoji: "💇", label: "Salons", desc: "Multi-staff calendar, deposits, colour service protection" },
  { href: "/for/barbers", emoji: "✂️", label: "Barbers", desc: "SMS reminders, fast rebook, Google review automation" },
  { href: "/for/lash-techs", emoji: "👁️", label: "Lash Techs", desc: "Fill reminders, deposit protection for long appointments" },
  { href: "/for/estheticians", emoji: "✨", label: "Estheticians", desc: "Intake forms, facial packages, PIPEDA-aware health data" },
  { href: "/for/massage-therapists", emoji: "💆", label: "Massage Therapists", desc: "Health intake, gift cards, deposit protection" },
  { href: "/for/pet-groomers", emoji: "🐾", label: "Pet Groomers", desc: "Breed notes, pickup SMS, deposit to stop no-shows" },
  { href: "/for/consultants", emoji: "💼", label: "Consultants", desc: "Manual approval, deposit, Google Calendar sync" },
  { href: "/for/wellness", emoji: "🧘", label: "Wellness Providers", desc: "Memberships, group classes, rebooking automations" },
  { href: "/for/mobile-services", emoji: "🚐", label: "Mobile Services", desc: "Address intake, travel buffer time, deposit protection" },
  { href: "/for/personal-trainers", emoji: "🏋️", label: "Personal Trainers", desc: "Recurring sessions, deposits, calendar sync, SMS reminders" },
  { href: "/for/hair-stylists", emoji: "💇‍♀️", label: "Hair Stylists", desc: "Colour service protection, deposits, rebooking reminders" },
  { href: "/for/nail-techs", emoji: "💅", label: "Nail Techs", desc: "Deposit protection for gel sets and acrylics" },
  { href: "/for/spas", emoji: "🧖", label: "Spas", desc: "Multi-therapist scheduling, packages, gift cards" },
  { href: "/for/yoga-studios", emoji: "🧘", label: "Yoga Studios", desc: "Group classes, memberships, class passes" },
];

const cities = [
  { href: "/for/toronto", label: "Toronto", desc: "Appointment booking software for Toronto service businesses" },
  { href: "/for/vancouver", label: "Vancouver", desc: "Salon and wellness booking software for Vancouver" },
  { href: "/for/calgary", label: "Calgary", desc: "Booking software for Calgary salons, spas, and mobile services" },
  { href: "/for/ottawa", label: "Ottawa", desc: "Appointment booking software for Ottawa service providers" },
  { href: "/for/edmonton", label: "Edmonton", desc: "Online appointment booking for Edmonton businesses" },
  { href: "/for/winnipeg", label: "Winnipeg", desc: "Booking software for Winnipeg service businesses" },
];

export default function ForPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Appointments</span>
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Built for your industry</h1>
        <p className="text-slate-500 mb-8">Pulse works for any Canadian service business. See how it fits yours.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {industries.map((i) => (
            <Link key={i.href} href={i.href} className="flex items-start gap-3 bg-white rounded-2xl border border-slate-200 p-4 hover:border-violet-300 hover:shadow-sm transition-all group">
              <span className="text-2xl" aria-hidden="true">{i.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-violet-700">{i.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{i.desc}</p>
              </div>
            </Link>
          ))}
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mt-14 mb-2">Built for Canadian cities</h2>
        <p className="text-slate-500 mb-6">Local landing pages for high-intent city searches.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {cities.map((city) => (
            <Link key={city.href} href={city.href} className="block bg-white rounded-2xl border border-slate-200 p-4 hover:border-violet-300 hover:shadow-sm transition-all group">
              <p className="text-sm font-semibold text-slate-900 group-hover:text-violet-700">{city.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{city.desc}</p>
            </Link>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/register" className="inline-block bg-violet-600 text-white font-semibold text-sm rounded-xl px-6 py-3 hover:bg-violet-700 transition-colors">
            Get started free — any industry →
          </Link>
        </div>
      </div>
    </div>
  );
}
