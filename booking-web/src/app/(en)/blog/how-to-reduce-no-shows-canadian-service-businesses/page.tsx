import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Reduce No-Shows for Canadian Service Businesses | Pulse",
  description:
    "No-shows cost Canadian service businesses thousands per year. Learn the proven deposit + reminder system that cuts no-shows by 80% — used by salons, spas, and barbers across Canada.",
  openGraph: {
    title: "How to Reduce No-Shows for Canadian Service Businesses",
    description:
      "The deposit + reminder system that cuts no-shows by 80%. Practical guide for Canadian salons, spas, and service businesses.",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How to Reduce No-Shows for Canadian Service Businesses",
  datePublished: "2026-06-25",
  dateModified: "2026-06-25",
  author: { "@type": "Organization", name: "Pulse Appointments" },
  publisher: { "@type": "Organization", name: "Pulse Appointments", url: "https://www.pulseappointments.com" },
  url: "https://www.pulseappointments.com/blog/how-to-reduce-no-shows-canadian-service-businesses",
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Blog", item: "https://www.pulseappointments.com/blog" },
    { "@type": "ListItem", position: 3, name: "How to Reduce No-Shows for Canadian Service Businesses", item: "https://www.pulseappointments.com/blog/how-to-reduce-no-shows-canadian-service-businesses" },
  ],
};

export default function NoShowsPost() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

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

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Back link */}
        <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-violet-600 transition-colors mb-10">
          ← Back to blog
        </Link>

        {/* Article header */}
        <div className="mb-10">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-violet-600 bg-violet-50 px-3 py-1 rounded-full mb-4">
            No-Shows
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            How to Reduce No-Shows for Canadian Service Businesses
          </h1>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>June 25, 2026</span>
            <span>·</span>
            <span>8 min read</span>
          </div>
        </div>

        {/* Article body */}
        <article className="prose-custom">

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">The real cost of a no-show</h2>
          <p className="text-slate-600 leading-relaxed mb-4">A no-show isn&apos;t just an empty slot. It&apos;s:</p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>The revenue from that appointment — gone</li>
            <li>The time you blocked — gone</li>
            <li>Your supplies or setup — wasted</li>
            <li>A slot another client could have taken — lost</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mb-4">
            For a salon charging $120 for a colour service, 3 no-shows a week = $360/week = <strong className="text-slate-800">$18,720 a year</strong> in lost revenue. That&apos;s not a minor inconvenience. That&apos;s the cost of a part-time employee.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Why clients no-show (and why it&apos;s not always malicious)</h2>
          <p className="text-slate-600 leading-relaxed mb-4">Most no-shows aren&apos;t deliberate. They happen because:</p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>Clients forget (especially for bookings made weeks in advance)</li>
            <li>Life changes and they don&apos;t bother cancelling because it &quot;feels awkward&quot;</li>
            <li>There&apos;s no financial consequence for not showing up</li>
            <li>The rebooking process is inconvenient so they just disappear</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mb-4">The solution addresses each of these causes directly.</p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">The 3-part system that cuts no-shows by 80%</h2>

          <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Part 1: Require a deposit at booking</h3>
          <p className="text-slate-600 leading-relaxed mb-4">
            This is the single most effective thing you can do. When a client puts money down, they have skin in the game. Bookings without deposits are free to abandon. Bookings with deposits are commitments.
          </p>
          <p className="text-slate-600 leading-relaxed mb-2"><strong className="text-slate-800">What to charge:</strong></p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>For appointments under 60 min: $20–$30 flat deposit</li>
            <li>For appointments 60–90 min: 25% of the service price</li>
            <li>For colour services or long treatments: 25–50%</li>
            <li>For new clients (higher no-show risk): full service price upfront</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">The psychology:</strong> When a client has paid $35 toward a $140 colour appointment, they think twice before sleeping in. The deposit isn&apos;t punitive — it&apos;s a commitment device.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Handling the objection:</strong> Some clients will push back. That&apos;s okay. Clients who refuse to pay a deposit are often the ones most likely to no-show. The deposit filters your client list toward the ones who respect your time.
          </p>

          <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Part 2: Automated reminders at the right intervals</h3>
          <p className="text-slate-600 leading-relaxed mb-4">Most no-shows happen because clients forget. The solution is simple: remind them.</p>
          <p className="text-slate-600 leading-relaxed mb-2"><strong className="text-slate-800">The reminder schedule that works:</strong></p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li><strong className="text-slate-700">72 hours before:</strong> Email reminder with appointment details and your cancellation policy</li>
            <li><strong className="text-slate-700">24 hours before:</strong> Email + SMS reminder (&quot;Your appointment is tomorrow at 2pm — reply CANCEL if you need to reschedule&quot;)</li>
            <li><strong className="text-slate-700">2 hours before:</strong> SMS for same-day appointments only</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mb-4">
            The 24-hour reminder is the most important. It gives clients enough notice to cancel (so you can rebook the slot) while creating urgency. The SMS at 24h is the one that actually gets read.
          </p>
          <p className="text-slate-600 leading-relaxed mb-2"><strong className="text-slate-800">What to include in reminders:</strong></p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>Date, time, and service</li>
            <li>Your address or a link to their booking details</li>
            <li>Your cancellation policy (in plain language)</li>
            <li>A way to reschedule (link to your booking page)</li>
          </ul>

          <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Part 3: A real cancellation policy — enforced automatically</h3>
          <p className="text-slate-600 leading-relaxed mb-4">
            Having a cancellation policy written somewhere is useless if you don&apos;t enforce it. Most service providers have a policy but never charge it because the conversation is awkward.
          </p>
          <blockquote className="border-l-4 border-violet-400 pl-4 text-slate-600 italic my-6">
            Cancellations made less than 24 hours before your appointment will be charged 50% of the service price. No-shows will be charged the full deposit (or 100% of the service price if no deposit was taken).
          </blockquote>
          <p className="text-slate-600 leading-relaxed mb-4">
            Post this on your booking page, in your confirmation email, and in your 24h reminder. When it&apos;s written clearly upfront, enforcing it isn&apos;t a confrontation — it&apos;s just following the policy the client agreed to when they booked.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Automate the charge:</strong> With card-on-file, you don&apos;t have to send an awkward invoice or have a phone conversation. The charge happens automatically. The client gets a receipt. The awkward conversation never happens.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">What to do when a client disputes the fee</h2>
          <p className="text-slate-600 leading-relaxed mb-4">This happens rarely when the policy is communicated clearly upfront. When it does:</p>
          <ol className="list-decimal list-inside text-slate-600 mb-4 space-y-1">
            <li>Point to the policy they agreed to at booking (your booking confirmation email)</li>
            <li>Offer to credit the fee toward a future appointment (goodwill gesture that usually works)</li>
            <li>If the dispute is persistent, decide whether this client is worth keeping</li>
          </ol>
          <p className="text-slate-600 leading-relaxed mb-4">
            Most clients, when reminded of a policy they agreed to, accept it. The ones who don&apos;t are often the ones you&apos;re better off without.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Handling last-minute cancellations for rebooking</h2>
          <p className="text-slate-600 leading-relaxed mb-4">Even with deposits and reminders, some cancellations will happen. The goal is to fill those slots quickly.</p>
          <p className="text-slate-600 leading-relaxed mb-2"><strong className="text-slate-800">Tactics:</strong></p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>Keep a waitlist for popular time slots. When a cancellation comes in, contact the next person on the list immediately.</li>
            <li>Post your open slot on your Instagram Stories. &quot;Cancellation opening at 3pm today — DM to book&quot; fills slots faster than you&apos;d think.</li>
            <li>Set a same-day cancellation fee higher than the standard one. Clients who cancel with 2 hours notice are harder to replace.</li>
          </ul>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Results you can expect</h2>
          <p className="text-slate-600 leading-relaxed mb-4">Based on service businesses using deposits + automated reminders:</p>
          <div className="overflow-x-auto rounded-xl border border-[#E9DDCB] mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#E9DDCB] bg-slate-50">
                  <th className="text-left px-5 py-3 font-semibold text-slate-700">Before</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-700">After</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["4–5 no-shows per week", "0–1 no-shows per week"],
                  ["0% deposit coverage", "25–100% of service prepaid"],
                  ["Manual reminder calls", "Automated — zero time spent"],
                  ["Awkward fee conversations", "Auto-charged — no conversation"],
                ].map(([before, after]) => (
                  <tr key={before} className="border-b border-[#E9DDCB] last:border-0">
                    <td className="px-5 py-3 text-slate-600">{before}</td>
                    <td className="px-5 py-3 text-slate-600">{after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-slate-600 leading-relaxed mb-4">
            The average service business that implements a full deposit + reminder + cancellation policy system reduces no-shows by 75–85% within the first month.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Setting this up in Pulse</h2>
          <p className="text-slate-600 leading-relaxed mb-4">In Pulse, you can turn on all three parts of this system in under 10 minutes:</p>
          <ol className="list-decimal list-inside text-slate-600 mb-4 space-y-2">
            <li><strong className="text-slate-700">Deposits:</strong> Go to Services → edit any service → enable &quot;Require deposit&quot; and set the amount</li>
            <li><strong className="text-slate-700">Reminders:</strong> Settings → Notifications → enable Email and SMS reminders at 72h, 24h, and 2h</li>
            <li><strong className="text-slate-700">Cancellation policy:</strong> Settings → Booking → set your cancellation window and fee percentage. With card-on-file enabled, charges happen automatically.</li>
          </ol>
          <p className="text-slate-600 leading-relaxed mb-4">
            Once it&apos;s set up, you don&apos;t touch it again. The system runs in the background and protects your revenue automatically.
          </p>
        </article>

        {/* CTA box */}
        <div className="mt-12 rounded-2xl bg-[#19212B] p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Ready to protect your appointments?</h2>
          <p className="text-white/60 mb-6 text-sm">Start free — deposits, reminders, and cancellation fees set up in 10 minutes.</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-6 py-3 rounded-xl hover:bg-violet-50 transition-colors"
          >
            Start free with Pulse →
          </Link>
        </div>

        <div className="mt-8">
          <Link href="/blog" className="text-sm text-slate-500 hover:text-violet-600 transition-colors">
            ← Back to blog
          </Link>
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
