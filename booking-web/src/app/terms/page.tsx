import Link from "next/link";
import { AlertTriangle, CalendarCheck, CreditCard, FileText, Scale, ShieldCheck, Users } from "lucide-react";

export const metadata = { title: "Terms of Service | Pulse Appointments" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F8F5EF] px-5 py-12 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse Appointments" className="h-9 w-9 object-contain" />
          <span className="text-xl font-bold tracking-tight text-slate-950">Pulse Appointments</span>
        </Link>

        <article className="overflow-hidden rounded-[2rem] border border-amber-900/10 bg-white shadow-xl shadow-amber-950/5">
          <header className="bg-amber-600 px-7 py-10 text-white sm:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">Agreement</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
            <p className="mt-3 text-sm text-amber-100">Effective June 13, 2026 · Calgary, Alberta, Canada</p>
          </header>

          <div className="space-y-10 px-7 py-9 text-sm leading-7 text-slate-600 sm:px-12 sm:py-12">
            <div className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-800">
              <FileText className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
              <p>These Terms form a binding agreement between you and <strong>Idowu Ayeni, operating Pulse Appointments</strong> (&quot;Pulse,&quot; &quot;we,&quot; or &quot;us&quot;). By creating an account, booking through Pulse, or otherwise using the service, you agree to these Terms and our <Link href="/privacy" className="font-semibold text-amber-700 hover:underline">Privacy Policy</Link>.</p>
            </div>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><Users className="h-5 w-5 text-amber-600" />1. Eligibility and accounts</h2>
              <div className="space-y-3">
                <p>Business account holders must be at least 18, have authority to bind the business they represent, and provide accurate information. You are responsible for staff users, credentials, permissions, and all activity under your account.</p>
                <p>Keep passwords and recovery codes confidential, enable two-factor authentication, and promptly report suspected compromise. Pulse may require identity, business, or payment verification and may refuse or suspend accounts where information is inaccurate or risk is unacceptable.</p>
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><CalendarCheck className="h-5 w-5 text-amber-600" />2. Platform role and business responsibilities</h2>
              <div className="space-y-3">
                <p>Pulse supplies scheduling, booking, messaging, payment-support, and business-management software. Each listed business is independent and is solely responsible for its services, staff, licences, prices, taxes, availability, safety, client relationship, cancellation policy, refunds, and compliance with laws that apply to it.</p>
                <p>Pulse is not a party to the service contract between a business and its client, does not employ service providers, and does not guarantee a business, client, appointment, result, or service quality. Businesses must present accurate descriptions and obtain all consents needed to collect client information and send communications.</p>
                <p>Users must not use Pulse for unlawful, fraudulent, misleading, abusive, discriminatory, infringing, unsafe, or unsolicited activity; introduce malicious code; probe security; scrape or resell the platform; or access information without authorization.</p>
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><CreditCard className="h-5 w-5 text-amber-600" />3. Bookings, client charges, and disputes</h2>
              <div className="space-y-3">
                <p>A business may require a deposit, card on file, no-show fee, or late-cancellation fee. The business must disclose its policy and charge before confirmation. By confirming a booking and submitting a payment method, the client authorizes the disclosed charges through Stripe.</p>
                <p>Stripe and the connected business process payments. Pulse does not hold client funds and does not set a business&apos;s cancellation or refund policy. Clients should first contact the business about appointment quality, refunds, or disputed charges, then contact their card issuer or Pulse support if needed.</p>
                <p>Chargebacks, reversals, refunds, taxes, negative balances, and processor fees may be passed to the responsible business where permitted. Pulse may delay or restrict payment features to manage fraud, legal, or processor risk.</p>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">4. Subscription plans and billing</h2>
              <div className="space-y-3">
                <p>Plan features and prices are shown before checkout. Unless stated otherwise, paid plans renew automatically each billing period until cancelled. Prices are in the displayed currency and exclude applicable sales taxes. Stripe processing fees or transaction fees are separate where disclosed.</p>
                <p>You authorize recurring charges to the payment method on file. You may cancel through <strong>Settings → Billing</strong>; cancellation normally takes effect at the end of the paid period. Fees already billed are non-refundable except where required by law or where Pulse confirms a billing error. Contact <strong>support@pulseappointments.com</strong> promptly about billing errors.</p>
                <p>We may change future prices or plan features with reasonable advance notice. A price change applies no earlier than the next renewal after the stated effective date. Continued use after that date constitutes acceptance; you may cancel before renewal.</p>
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><ShieldCheck className="h-5 w-5 text-amber-600" />5. Privacy, communications, and content</h2>
              <div className="space-y-3">
                <p>Our handling of personal information is described in the Privacy Policy. Businesses remain responsible for their client notices, lawful authority, consent, retention, and responses to client requests. Do not upload information that is unnecessary for scheduling or that you are not authorized to process.</p>
                <p>Transactional messages may be sent to operate appointments and accounts. Businesses using marketing tools must comply with Canada&apos;s anti-spam legislation, including consent, sender identification, records, and unsubscribe requirements.</p>
                <p>You retain ownership of content you submit. You grant Pulse a non-exclusive licence to host, copy, process, transmit, and display that content only as reasonably needed to operate, secure, support, and improve the service. You represent that you have the rights required to provide it.</p>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">6. Intellectual property and feedback</h2>
              <p>Pulse, its software, design, branding, documentation, and underlying technology are owned by the operator or licensors and are protected by applicable intellectual-property laws. These Terms grant only a limited, revocable, non-transferable right to use the service. Feedback may be used without restriction or compensation, provided we do not identify you publicly without permission.</p>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><AlertTriangle className="h-5 w-5 text-amber-600" />7. Availability, disclaimers, and liability</h2>
              <div className="space-y-3">
                <p>Pulse is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the extent permitted by law, we disclaim implied warranties of merchantability, fitness for a particular purpose, non-infringement, and uninterrupted or error-free operation. Third-party services, networks, and payment processors may be unavailable or change independently of Pulse.</p>
                <p>To the maximum extent permitted by law, Pulse is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages; lost profits, revenue, goodwill, data, appointments, or business interruption; or conduct of a business, client, staff member, or third party.</p>
                <p>Pulse&apos;s total aggregate liability arising from the service will not exceed the greater of CAD $100 or the subscription fees you paid Pulse in the three months before the event giving rise to the claim. These exclusions do not apply where prohibited by law, including liability that cannot legally be limited.</p>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">8. Indemnity</h2>
              <p>To the extent permitted by law, a business user will defend, indemnify, and hold Pulse and its operator harmless from third-party claims, losses, and reasonable costs arising from that business&apos;s services, content, staff, client relationship, privacy or messaging practices, taxes, breach of these Terms, or violation of law. Pulse will provide reasonable notice and cooperation, and the business may not settle a claim in a way that admits liability for Pulse without consent.</p>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">9. Suspension, termination, and data</h2>
              <div className="space-y-3">
                <p>You may stop using Pulse or cancel a subscription at any time. We may suspend or terminate access for non-payment, security risk, fraud, unlawful conduct, material breach, processor requirements, or risk to users or the platform. Where reasonable, we will provide notice and an opportunity to correct the issue.</p>
                <p>After termination, access may end immediately. Data is retained and deleted according to the Privacy Policy, backup cycles, and legal obligations. Request an export before closing an account; export availability depends on the tools then offered and account standing.</p>
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><Scale className="h-5 w-5 text-amber-600" />10. Governing law and disputes</h2>
              <div className="space-y-3">
                <p>These Terms are governed by Alberta law and the federal laws of Canada applicable there, without regard to conflict-of-law rules. Subject to any mandatory consumer right, the courts located in Calgary, Alberta have exclusive jurisdiction.</p>
                <p>Before starting a claim, contact <strong>support@pulseappointments.com</strong> and give us 30 days to attempt an informal resolution. Nothing in these Terms prevents either party from seeking urgent injunctive relief or using a small-claims process where eligible.</p>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">11. General terms and changes</h2>
              <p>These Terms and incorporated policies are the entire agreement about Pulse. If a provision is unenforceable, it will be limited or removed without affecting the rest. Failure to enforce a term is not a waiver. You may not assign this agreement without consent; Pulse may assign it as part of a reorganization, financing, or transfer of the service. We may update these Terms with reasonable notice of material changes. Continued use after the effective date means acceptance.</p>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">12. Contact</h2>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="font-bold text-slate-900">Idowu Ayeni, operating Pulse Appointments</p>
                <p>3 St. SE, Calgary, Alberta T2G 0T9, Canada</p>
                <p>Email: <a className="font-semibold text-amber-700 hover:underline" href="mailto:support@pulseappointments.com">support@pulseappointments.com</a></p>
              </div>
            </section>

            <footer className="flex flex-col gap-4 border-t border-slate-100 pt-7 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">© 2026 Pulse Appointments</p>
              <div className="flex gap-5 font-semibold text-amber-700"><Link href="/privacy" className="hover:underline">Privacy Policy</Link><Link href="/" className="hover:underline">Home</Link></div>
            </footer>
          </div>
        </article>
      </div>
    </main>
  );
}
