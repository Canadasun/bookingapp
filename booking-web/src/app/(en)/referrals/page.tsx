import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeDollarSign, Gift, Link2, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Referral Program for Canadian Service Businesses | Pulse Appointments",
  description: "Share Pulse with another Canadian service business. Referral codes are built into signup and billing so eligible rewards can be applied through Stripe.",
  alternates: { canonical: "/referrals" },
  openGraph: {
    title: "Pulse Referral Program",
    description: "Invite another Canadian service business to Pulse with a referral code.",
    url: "https://www.pulseappointments.com/referrals",
  },
};

const steps = [
  {
    icon: Link2,
    title: "Copy your link",
    body: "Owners can copy their referral link from Billing & plan in the Pulse dashboard.",
  },
  {
    icon: Gift,
    title: "They subscribe",
    body: "The referred business signs up with your code and applies it before upgrading.",
  },
  {
    icon: BadgeDollarSign,
    title: "Credit is applied",
    body: "When their subscription starts, Pulse records the referral and applies the configured account credit to your next Pulse invoice.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I get my Pulse referral code?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sign in to Pulse, open Settings, then Billing & plan. Your referral link appears in the referral section.",
      },
    },
    {
      "@type": "Question",
      name: "When is the referral reward applied?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Pulse records the referral when the referred business uses a valid code during checkout. The referrer account credit is applied after the referred business starts a paid subscription.",
      },
    },
    {
      "@type": "Question",
      name: "Can a business use its own referral code?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Pulse ignores referral codes that belong to the same business account.",
      },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Referral Program", item: "https://www.pulseappointments.com/referrals" },
  ],
};

export default function ReferralsPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF] text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([faqSchema, breadcrumbSchema]) }} />
      <section className="border-b border-[#E9DDCB] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="h-8 w-8 object-contain" />
            <span className="text-base font-bold tracking-tight">Pulse Appointments</span>
          </Link>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Start free <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Referral program
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Share Pulse with another Canadian service business
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Pulse has referral codes built into signup, billing, and Stripe checkout. Send your link to another owner, and eligible rewards are tracked automatically when they become a paying customer.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard/settings?section=billing" className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800">
              Copy my referral link <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/pricing" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              View plans
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-[#E9DDCB] bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-12 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="rounded-lg border border-slate-200 p-5">
              <step.icon className="h-5 w-5 text-violet-700" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold text-slate-950">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-4 md:grid-cols-3">
          {faqSchema.mainEntity.map((item) => (
            <div key={item.name} className="rounded-lg border border-[#E9DDCB] bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-950">{item.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.acceptedAnswer.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
