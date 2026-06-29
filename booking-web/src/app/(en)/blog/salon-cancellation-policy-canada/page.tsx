import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

const SITE_URL = "https://www.pulseappointments.com";
const slug = "salon-cancellation-policy-canada";

export const metadata: Metadata = {
  title: "Salon Cancellation Policy Canada: Practical Template | Pulse",
  description:
    "A practical cancellation policy guide for Canadian salons and service businesses: notice windows, deposits, no-show fees, reminders, and client communication.",
  openGraph: {
    title: "Salon Cancellation Policy Canada",
    description: "A practical cancellation policy template and enforcement checklist for Canadian service businesses.",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Salon Cancellation Policy Canada: Practical Template",
  datePublished: "2026-06-25",
  dateModified: "2026-06-25",
  author: { "@type": "Organization", name: "Pulse Appointments" },
  publisher: { "@type": "Organization", name: "Pulse Appointments", url: SITE_URL },
  url: `${SITE_URL}/blog/${slug}`,
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
    { "@type": "ListItem", position: 3, name: "Salon Cancellation Policy Canada", item: `${SITE_URL}/blog/${slug}` },
  ],
};

export default function SalonCancellationPolicyPost() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <nav className="bg-white/80 backdrop-blur-xl border-b border-[#E9DDCB] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-slate-900 tracking-tight">Pulse Booking</span>
          </Link>
          <Link href="/register" className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors">
            Get started free
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-violet-600 transition-colors mb-10">
          ← Back to blog
        </Link>

        <header className="mb-10">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-violet-600 bg-violet-50 px-3 py-1 rounded-full mb-4">
            Policy
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            Salon Cancellation Policy Canada: Practical Template
          </h1>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>June 25, 2026</span>
            <span>·</span>
            <span>8 min read</span>
          </div>
        </header>

        <article className="prose-custom">
          <p className="text-slate-600 leading-relaxed mb-4">
            A cancellation policy only works when clients see it before booking, understand it, and know it will be enforced. The wording should be clear, short, and consistent across your booking page, confirmation email, and reminders.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">A simple policy template</h2>
          <blockquote className="border-l-4 border-violet-400 pl-4 text-slate-600 italic my-6">
            Please give at least 24 hours of notice to cancel or reschedule. Cancellations inside 24 hours may be charged 50% of the service price. No-shows may be charged the full deposit or posted no-show fee. Deposits are applied to your final balance.
          </blockquote>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Set the right notice window</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Short services can often use a 24-hour window. Longer services, colour work, spa packages, or services with setup time may need 48 hours. The harder the slot is to refill, the earlier your cancellation window should be.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Put the policy in three places</h2>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>Your booking page before checkout</li>
            <li>The client confirmation email</li>
            <li>The 24-hour reminder message</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mb-4">
            If clients only see the policy after they miss the appointment, it feels like a surprise. If they see it before they book, it feels like a normal business rule.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Use deposits for high-risk appointments</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Deposits are especially useful for new clients, long services, and peak-time appointments. A small upfront payment changes behaviour and gives your policy real weight.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Automate reminders before you automate fees</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Good reminder timing reduces accidental no-shows. Start with a confirmation email, a 72-hour reminder, and a 24-hour SMS. Then use no-show fees for the smaller number of clients who still miss their slot.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            Pulse brings the policy, deposit, reminder, and card-on-file pieces together. See <Link href="/features/no-show-protection" className="text-violet-600 hover:underline">no-show protection</Link> and <Link href="/features/sms-reminders" className="text-violet-600 hover:underline">SMS reminders</Link>.
          </p>

          <p className="text-sm text-slate-500 leading-relaxed mt-8">
            This article is operational guidance, not legal advice. Review your policy with a qualified professional if your business has regulated services, unusual refund terms, or province-specific requirements.
          </p>
        </article>

        <div className="mt-12 rounded-2xl bg-[#19212B] p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Make your policy easier to enforce</h2>
          <p className="text-white/60 mb-6 text-sm">Use deposits, reminders, and card-on-file inside Pulse.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-6 py-3 rounded-xl hover:bg-violet-50 transition-colors">
            Start free with Pulse →
          </Link>
        </div>
      </div>
    </main>
  );
}
