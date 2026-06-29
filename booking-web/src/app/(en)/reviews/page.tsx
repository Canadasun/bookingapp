import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, ShieldCheck, Star } from "lucide-react";

export const metadata: Metadata = {
  title: "Customer Review Collection for Service Businesses | Pulse Appointments",
  description: "Pulse helps Canadian service businesses collect, moderate, and publish real appointment reviews without fabricated testimonials.",
  alternates: buildAlternates("/reviews"),
  openGraph: {
    title: "Real Review Collection | Pulse Appointments",
    description: "Collect and publish reviews tied to completed appointments.",
    url: "https://www.pulseappointments.com/reviews",
  },
};

const items = [
  {
    icon: CheckCircle2,
    title: "Appointment-based requests",
    copy: "Review links are sent after completed appointments, so feedback is connected to real service activity.",
  },
  {
    icon: Eye,
    title: "Owner moderation",
    copy: "Publish or hide reviews from the dashboard before they appear on the public booking page.",
  },
  {
    icon: ShieldCheck,
    title: "No placeholder testimonials",
    copy: "Pulse avoids fabricated quotes and gives you the tools to earn publishable proof from real clients.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does Pulse publish fake testimonials?",
      acceptedAnswer: { "@type": "Answer", text: "No. Pulse is designed to collect reviews from real appointment activity and lets owners decide which reviews are public." },
    },
    {
      "@type": "Question",
      name: "Where do public reviews appear?",
      acceptedAnswer: { "@type": "Answer", text: "Published reviews appear on the business public booking page where clients choose services and appointment times." },
    },
    {
      "@type": "Question",
      name: "Can I hide a review?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Owners can hide or publish reviews from the Reviews area in the Pulse dashboard." },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Reviews", item: "https://www.pulseappointments.com/reviews" },
  ],
};

export default function ReviewsMarketingPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF] text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([faqSchema, breadcrumbSchema]) }} />
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Real reviews</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              Turn completed appointments into public trust
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Pulse helps service businesses collect and publish review signals from real clients instead of relying on placeholder testimonials.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800">
                Start collecting reviews <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/trust" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Trust center
              </Link>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-[#E9DDCB] bg-white p-5 shadow-xl shadow-amber-100/60">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Public rating</p>
                  <p className="text-3xl font-bold text-slate-950">4.9</p>
                </div>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className="h-5 w-5 fill-amber-400 text-amber-400" aria-hidden="true" />
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {["Published review from a completed appointment", "Owner can hide or publish from dashboard", "Rating summary appears on public booking page"].map((line) => (
                  <div key={line} className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#E9DDCB] bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-12 md:grid-cols-3">
          {items.map(({ icon: Icon, title, copy }) => (
            <div key={title} className="rounded-lg border border-slate-200 p-5">
              <Icon className="h-5 w-5 text-violet-700" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
