import Link from "next/link";
import { buildAlternates } from "@/lib/hreflang";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: buildAlternates("/blog"),
  title: "Blog | Pulse Appointments",
  description: "Tips, guides, and insights for Canadian service businesses — booking, no-shows, deposits, and growing your appointments.",
};

const posts = [
  {
    slug: "how-to-reduce-no-shows-canadian-service-businesses",
    category: "No-Shows",
    title: "How to Reduce No-Shows for Canadian Service Businesses",
    excerpt: "No-shows cost Canadian service businesses thousands of dollars a year. Here's a practical, proven system to cut them by 80% or more.",
    date: "June 25, 2026",
    readTime: "8 min read",
  },
  {
    slug: "best-appointment-booking-software-canada-2026",
    category: "Comparison",
    title: "Best Appointment Booking Software Canada 2026: Full Comparison",
    excerpt: "We compared the top booking platforms for Canadian service businesses on price, features, CAD support, and no-show protection.",
    date: "June 25, 2026",
    readTime: "12 min read",
  },
  {
    slug: "how-to-take-appointment-deposits-canada",
    category: "Deposits",
    title: "How to Take Appointment Deposits in Canada",
    excerpt: "A practical guide to deposit amounts, booking policy language, refunds, and card-on-file basics for Canadian service businesses.",
    date: "June 25, 2026",
    readTime: "7 min read",
  },
  {
    slug: "salon-cancellation-policy-canada",
    category: "Policy",
    title: "Salon Cancellation Policy Canada: Practical Template",
    excerpt: "A clear cancellation policy template with notice windows, deposit handling, reminders, and enforcement tips for Canadian salons.",
    date: "June 25, 2026",
    readTime: "8 min read",
  },
];

const blogSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Pulse Appointments Blog",
  url: "https://www.pulseappointments.com/blog",
  description: "Tips and guides for Canadian service businesses",
};

export default function BlogIndexPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }} />

      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-[#E9DDCB] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-slate-900 tracking-tight">Pulse Booking</span>
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="mb-14">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            The Pulse Blog
          </h1>
          <p className="text-lg text-slate-500 max-w-xl">
            Booking tips, no-show guides, and growth strategies for Canadian service businesses.
          </p>
        </div>

        {/* Post grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          {posts.map((post) => (
            <article key={post.slug} className="rounded-2xl border border-[#E9DDCB] bg-white p-7 flex flex-col hover:shadow-md transition-shadow">
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-violet-600 bg-violet-50 px-3 py-1 rounded-full mb-4 self-start">
                {post.category}
              </span>
              <h2 className="text-lg font-bold text-slate-900 mb-3 leading-snug">
                {post.title}
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-5 flex-1">
                {post.excerpt}
              </p>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  <span>{post.date}</span>
                  <span className="mx-2">·</span>
                  <span>{post.readTime}</span>
                </div>
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-sm font-semibold text-violet-600 hover:underline"
                >
                  Read more →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E9DDCB] bg-white/80 py-8 mt-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
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
