import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Best Appointment Booking Software Canada 2026 | Pulse",
  description:
    "We compared the top booking platforms for Canadian service businesses: Pulse, Jane App, Vagaro, Acuity, Calendly, and Square. See which wins on CAD pricing, no-show protection, and ease of use.",
  openGraph: {
    title: "Best Appointment Booking Software Canada 2026",
    description:
      "Full comparison of Pulse, Jane App, Vagaro, Acuity, Calendly, and Square for Canadian service businesses.",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Best Appointment Booking Software Canada 2026: Full Comparison",
  datePublished: "2026-06-25",
  dateModified: "2026-06-25",
  author: { "@type": "Organization", name: "Pulse Appointments" },
  publisher: { "@type": "Organization", name: "Pulse Appointments", url: "https://www.pulseappointments.com" },
  url: "https://www.pulseappointments.com/blog/best-appointment-booking-software-canada-2026",
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Blog", item: "https://www.pulseappointments.com/blog" },
    { "@type": "ListItem", position: 3, name: "Best Appointment Booking Software Canada 2026", item: "https://www.pulseappointments.com/blog/best-appointment-booking-software-canada-2026" },
  ],
};

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-[#E9DDCB] bg-slate-50">
        {cols.map((c) => (
          <th key={c} className="text-left px-4 py-3 font-semibold text-slate-700 text-sm whitespace-nowrap">{c}</th>
        ))}
      </tr>
    </thead>
  );
}

export default function ComparisonPost() {
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
            Comparison
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            Best Appointment Booking Software Canada 2026: Full Comparison
          </h1>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>June 25, 2026</span>
            <span>·</span>
            <span>12 min read</span>
          </div>
        </div>

        <article>
          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">What makes booking software &quot;right&quot; for Canadian businesses?</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Most booking software reviews are written by Americans for American businesses. The recommendations that top Google results focus on USD pricing, US payment processors, and features that matter for US markets.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">Canadian service businesses have different needs:</p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li><strong className="text-slate-700">CAD pricing</strong> — USD billing at current exchange rates adds 35–40% to your monthly cost</li>
            <li><strong className="text-slate-700">PIPEDA compliance</strong> — Canada&apos;s privacy law governs how you collect and store client health information</li>
            <li><strong className="text-slate-700">CASL compliance</strong> — Canada&apos;s anti-spam law affects how you send marketing emails and SMS</li>
            <li><strong className="text-slate-700">GST/HST on invoices</strong> — your clients need proper Canadian tax receipts</li>
            <li><strong className="text-slate-700">No-show protection</strong> — deposits and auto-charges matter more in Canada&apos;s service economy where clients book weeks in advance</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mb-4">
            This comparison evaluates six platforms on criteria that actually matter to Canadian service businesses.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">The platforms compared</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            We looked at: <strong className="text-slate-800">Pulse Appointments, Jane App, Vagaro, Acuity Scheduling, Calendly, and Square Appointments.</strong>
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">1. CAD Pricing</h2>
          <div className="overflow-x-auto rounded-xl border border-[#E9DDCB] mb-6">
            <table className="w-full text-sm border-collapse">
              <TableHeader cols={["Platform", "Billing currency", "CAD impact"]} />
              <tbody>
                {[
                  ["Pulse", "CAD", "✅ No conversion"],
                  ["Jane App", "CAD", "✅ No conversion"],
                  ["Vagaro", "USD", "❌ ~35% premium"],
                  ["Acuity", "USD", "❌ ~35% premium"],
                  ["Calendly", "USD", "❌ ~35% premium"],
                  ["Square", "USD", "❌ ~35% premium"],
                ].map(([platform, currency, impact], i) => (
                  <tr key={platform} className={`border-b border-[#E9DDCB] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{platform}</td>
                    <td className="px-4 py-3 text-slate-600">{currency}</td>
                    <td className="px-4 py-3 text-slate-600">{impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-slate-600 leading-relaxed mb-4">
            If you&apos;re paying $39 USD/month for Acuity, you&apos;re actually paying ~$53 CAD at current rates — and that number changes every month.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Winner: Pulse and Jane App</strong> — both bill in CAD.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">2. No-Show Protection</h2>
          <p className="text-slate-600 leading-relaxed mb-4">This is where the biggest differences emerge.</p>
          <div className="overflow-x-auto rounded-xl border border-[#E9DDCB] mb-6">
            <table className="w-full text-sm border-collapse">
              <TableHeader cols={["Platform", "Deposits", "No-show auto-charge", "Card-on-file"]} />
              <tbody>
                {[
                  ["Pulse", "✅", "✅ Automatic", "✅"],
                  ["Jane App", "✅", "Partial", "Partial"],
                  ["Vagaro", "✅", "✅", "✅"],
                  ["Acuity", "✅", "❌ Deposit only", "❌"],
                  ["Calendly", "❌", "❌", "❌"],
                  ["Square", "✅", "Partial", "✅"],
                ].map(([platform, deposits, charge, cof], i) => (
                  <tr key={platform} className={`border-b border-[#E9DDCB] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{platform}</td>
                    <td className="px-4 py-3 text-slate-600">{deposits}</td>
                    <td className="px-4 py-3 text-slate-600">{charge}</td>
                    <td className="px-4 py-3 text-slate-600">{cof}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-slate-600 leading-relaxed mb-4">
            Calendly doesn&apos;t support deposits or no-show protection at all — it&apos;s a meeting scheduler, not a service business platform.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            Acuity collects deposits but won&apos;t auto-charge a no-show fee beyond the deposit. If your cancellation window passes and the client doesn&apos;t show, you&apos;re manually invoicing them.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            Pulse and Vagaro both support full automatic no-show charging. The key difference: Vagaro bills in USD.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Winner: Pulse</strong> — CAD billing + full auto-charge + card-on-file.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">3. Pricing (in CAD)</h2>
          <div className="overflow-x-auto rounded-xl border border-[#E9DDCB] mb-6">
            <table className="w-full text-sm border-collapse">
              <TableHeader cols={["Platform", "Entry paid plan", "Mid plan", "Notes"]} />
              <tbody>
                {[
                  ["Pulse", "$19 CAD/mo", "$39 CAD/mo", "Flat rate, unlimited staff on Pro"],
                  ["Jane App", "$79 CAD/mo", "$79 + per-practitioner", "$39/mo per additional practitioner"],
                  ["Vagaro", "~$35 USD (~$47 CAD)", "~$60 USD (~$81 CAD)", "Per-seat pricing"],
                  ["Acuity", "~$20 USD (~$27 CAD)", "~$61 USD (~$83 CAD)", "Add-ons cost extra"],
                  ["Calendly", "~$16 USD (~$22 CAD)", "~$20 USD per seat", "No service business features"],
                  ["Square", "Free", "~$80 USD (~$108 CAD)", "Per-seat escalation"],
                ].map(([platform, entry, mid, notes], i) => (
                  <tr key={platform} className={`border-b border-[#E9DDCB] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{platform}</td>
                    <td className="px-4 py-3 text-slate-600">{entry}</td>
                    <td className="px-4 py-3 text-slate-600">{mid}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-slate-600 leading-relaxed mb-4">
            Jane App&apos;s $79 CAD/month base is affordable for a solo practitioner but escalates fast for teams. A 4-person team on Jane runs ~$196/month CAD. The same team on Pulse Pro is $39/month.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Winner: Pulse</strong> — lowest CAD price with the most features included at flat rate.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">4. PIPEDA &amp; CASL Compliance</h2>
          <div className="overflow-x-auto rounded-xl border border-[#E9DDCB] mb-6">
            <table className="w-full text-sm border-collapse">
              <TableHeader cols={["Platform", "PIPEDA guidance", "CASL consent capture", "Canadian privacy page"]} />
              <tbody>
                {[
                  ["Pulse", "✅ Built-in", "✅", "✅"],
                  ["Jane App", "✅ Strong (health-focused)", "✅", "✅"],
                  ["Vagaro", "❌ No specific PIPEDA guidance", "❌", "❌"],
                  ["Acuity", "❌", "❌", "❌"],
                  ["Calendly", "❌", "❌", "❌"],
                  ["Square", "❌", "❌", "❌"],
                ].map(([platform, pipeda, casl, page], i) => (
                  <tr key={platform} className={`border-b border-[#E9DDCB] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{platform}</td>
                    <td className="px-4 py-3 text-slate-600">{pipeda}</td>
                    <td className="px-4 py-3 text-slate-600">{casl}</td>
                    <td className="px-4 py-3 text-slate-600">{page}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-slate-600 leading-relaxed mb-4">
            If you collect health information from clients (intake forms, conditions, allergies), PIPEDA requires you to handle it with specific protections. Only Pulse and Jane App address this explicitly.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Winner: Jane App</strong> (strongest health data compliance) / <strong className="text-slate-800">Pulse</strong> (for non-clinical businesses).
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">5. Ease of Setup</h2>
          <div className="overflow-x-auto rounded-xl border border-[#E9DDCB] mb-6">
            <table className="w-full text-sm border-collapse">
              <TableHeader cols={["Platform", "Time to first booking", "Technical skill required"]} />
              <tbody>
                {[
                  ["Pulse", "Under 5 minutes", "None"],
                  ["Jane App", "30–60 minutes", "Low — clinical setup overhead"],
                  ["Vagaro", "15–30 minutes", "Low"],
                  ["Acuity", "15–30 minutes", "Low-medium"],
                  ["Calendly", "5–10 minutes", "None"],
                  ["Square", "20–45 minutes", "Low — POS setup adds complexity"],
                ].map(([platform, time, skill], i) => (
                  <tr key={platform} className={`border-b border-[#E9DDCB] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{platform}</td>
                    <td className="px-4 py-3 text-slate-600">{time}</td>
                    <td className="px-4 py-3 text-slate-600">{skill}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-slate-600 leading-relaxed mb-4">
            Jane App&apos;s onboarding is more complex because it&apos;s designed for regulated health professionals with SOAP notes, insurance billing, and clinical workflows. If you&apos;re a salon or spa, you&apos;ll spend 30 minutes configuring things you&apos;ll never use.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Winner: Pulse and Calendly</strong> — both get you live in under 10 minutes.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">6. Who each platform is actually built for</h2>
          <div className="overflow-x-auto rounded-xl border border-[#E9DDCB] mb-6">
            <table className="w-full text-sm border-collapse">
              <TableHeader cols={["Platform", "Best for"]} />
              <tbody>
                {[
                  ["Pulse", "Canadian salons, spas, barbers, lash techs, massage therapists, wellness, pet groomers, mobile services"],
                  ["Jane App", "Canadian regulated health clinics (physio, chiro, RMT with insurance billing, psychology)"],
                  ["Vagaro", "US beauty businesses that need a marketplace/discovery channel"],
                  ["Acuity", "Simple service businesses in the US (before Squarespace acquisition issues)"],
                  ["Calendly", "Sales teams, recruiters, and professionals who book meetings — not services"],
                  ["Square", "Retail businesses with a physical POS that also offer services"],
                ].map(([platform, bestFor], i) => (
                  <tr key={platform} className={`border-b border-[#E9DDCB] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{platform}</td>
                    <td className="px-4 py-3 text-slate-600">{bestFor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Our verdict for Canadian service businesses</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Use Pulse if:</strong> You&apos;re a Canadian beauty, wellness, or service business that doesn&apos;t need health insurance billing. Best CAD pricing, no-show protection, and setup speed.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Use Jane App if:</strong> You&apos;re a regulated health professional in Canada who needs SOAP notes, direct billing (TELUS eClaims), and telehealth — and your team is small enough that the per-practitioner pricing doesn&apos;t sting.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Avoid Vagaro, Acuity, and Calendly</strong> if you&apos;re Canadian — the USD pricing alone costs you thousands extra per year, and none of them address PIPEDA or CASL.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Avoid Square</strong> unless you have a physical retail location that also offers services. The platform is built for POS-first businesses.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">The bottom line</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            For the vast majority of Canadian service businesses — salons, spas, barbers, lash techs, estheticians, massage therapists, pet groomers, and wellness providers — <strong className="text-slate-800">Pulse is the best option</strong> on every dimension that matters to Canadian operators:
          </p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>Lowest price in CAD</li>
            <li>Best no-show protection</li>
            <li>Fastest setup</li>
            <li>PIPEDA and CASL built-in</li>
            <li>Actively developed for the Canadian market</li>
          </ul>
        </article>

        {/* CTA box */}
        <div className="mt-12 rounded-2xl bg-[#19212B] p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Start free — no credit card required</h2>
          <p className="text-white/60 mb-6 text-sm">See for yourself why Canadian service businesses choose Pulse.</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-6 py-3 rounded-xl hover:bg-violet-50 transition-colors"
          >
            Get started free →
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
