import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  alternates: buildAlternates("/trust"),
  title: "Trust Center | Pulse Appointments",
  description:
    "Pulse Appointments trust center: security, Canadian privacy, verified businesses, real review collection, and product transparency.",
};

const trustItems = [
  {
    icon: LockKeyhole,
    title: "Security documentation",
    body: "Public security page covering transport security, password handling, monitoring, and account protection.",
    href: "/security",
    label: "Security",
  },
  {
    icon: ShieldCheck,
    title: "Canadian privacy guidance",
    body: "PIPEDA, provincial privacy, CASL, data residency, and health-information considerations for Canadian businesses.",
    href: "/canadian-privacy",
    label: "Canadian Privacy",
  },
  {
    icon: BadgeCheck,
    title: "Verified business badges",
    body: "Pulse can show a verified badge on booking pages after business identity checks are approved.",
    href: "/book",
    label: "Booking pages",
  },
  {
    icon: FileCheck2,
    title: "Shipped product history",
    body: "The changelog gives prospects a public record of ongoing development and maintenance.",
    href: "/changelog",
    label: "Changelog",
  },
];

export default function TrustPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
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
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Pulse trust center
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Trust should be verifiable. Pulse uses public documentation, verified-business workflows, real client review requests, and transparent product history instead of placeholder testimonials.
        </p>
      </section>

      <section className="pb-20">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-6">
          {trustItems.map(({ icon: Icon, title, body, href, label }) => (
            <Link key={href} href={href} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm hover:border-violet-300 hover:shadow-md transition-all">
              <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center mb-5">
                <Icon className="w-5 h-5 text-violet-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">{title}</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">{body}</p>
              <span className="text-sm font-semibold text-violet-600">{label} →</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
