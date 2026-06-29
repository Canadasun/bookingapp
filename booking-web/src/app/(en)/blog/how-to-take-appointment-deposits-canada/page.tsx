import Link from "next/link";
import { buildAlternates } from "@/lib/hreflang";
import Image from "next/image";
import type { Metadata } from "next";

const SITE_URL = "https://www.pulseappointments.com";
const slug = "how-to-take-appointment-deposits-canada";

export const metadata: Metadata = {
  alternates: buildAlternates("/blog/how-to-take-appointment-deposits-canada"),
  title: "How to Take Appointment Deposits in Canada | Pulse",
  description:
    "A practical guide for Canadian salons, spas, barbers, and service businesses that want to collect appointment deposits online and reduce no-shows.",
  openGraph: {
    title: "How to Take Appointment Deposits in Canada",
    description: "Deposit amounts, client policy wording, refund handling, and card-on-file basics for Canadian service businesses.",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How to Take Appointment Deposits in Canada",
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
    { "@type": "ListItem", position: 3, name: "How to Take Appointment Deposits in Canada", item: `${SITE_URL}/blog/${slug}` },
  ],
};

export default function AppointmentDepositsPost() {
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
            Deposits
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            How to Take Appointment Deposits in Canada
          </h1>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>June 25, 2026</span>
            <span>·</span>
            <span>7 min read</span>
          </div>
        </header>

        <article className="prose-custom">
          <p className="text-slate-600 leading-relaxed mb-4">
            Appointment deposits are one of the simplest ways to reduce no-shows. The goal is not to punish clients. The goal is to turn a casual booking into a real commitment and protect the time you blocked off.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Choose a deposit rule clients can understand</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Keep the rule simple enough that a client can understand it before they book. The best options are a flat amount for shorter services and a percentage for longer, higher-value services.
          </p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>$20 to $30 for short appointments</li>
            <li>25% for services around 60 to 90 minutes</li>
            <li>25% to 50% for colour, extensions, spa packages, or long treatments</li>
            <li>Full prepayment for high-risk bookings or special events</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Show the policy before payment</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Clients should see the deposit amount, what it applies to, and whether it is refundable before they confirm. Put the same language on your booking page, confirmation email, and reminder messages.
          </p>
          <blockquote className="border-l-4 border-violet-400 pl-4 text-slate-600 italic my-6">
            A deposit is required to reserve this appointment. Deposits are applied to your final balance. Deposits may be forfeited for no-shows or cancellations inside the posted cancellation window.
          </blockquote>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Decide how refunds work</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            A good policy separates early cancellations from last-minute cancellations. For example: refundable with 24 or 48 hours of notice, non-refundable inside that window, and reviewed manually for emergencies.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            This is business guidance, not legal advice. If you operate in a regulated field or have unusual refund terms, review your policy with a qualified professional.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Use card-on-file for the remaining policy</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Deposits help, but card-on-file makes your cancellation policy enforceable. If a client no-shows, you can charge the posted fee without an awkward invoice or manual follow-up.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            Pulse supports deposits, card-on-file, and no-show protection together. See the full <Link href="/features/deposits" className="text-violet-600 hover:underline">booking deposit feature page</Link>.
          </p>
        </article>

        <div className="mt-12 rounded-2xl bg-[#19212B] p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Collect deposits without extra admin</h2>
          <p className="text-white/60 mb-6 text-sm">Start free and add deposit rules to your services when you are ready.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-6 py-3 rounded-xl hover:bg-violet-50 transition-colors">
            Start free with Pulse →
          </Link>
        </div>
      </div>
    </main>
  );
}
