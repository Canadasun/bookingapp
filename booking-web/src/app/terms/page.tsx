import Link from "next/link";
import { Calendar, ShieldCheck, Scale, Database, CreditCard, AlertCircle, Bell, Smartphone } from "lucide-react";

export const metadata = { title: "Terms of Service — Pulse" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          <Calendar className="w-8 h-8 text-violet-600" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse</span>
        </Link>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 px-8 py-10 text-white">
            <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
            <p className="text-slate-400 text-sm">Last updated: June 8, 2026 · Calgary, Alberta</p>
          </div>

          <div className="p-8 md:p-12 space-y-10 text-sm text-slate-600 leading-relaxed">
            <div className="rounded-2xl bg-violet-50 border border-violet-100 p-6 flex gap-4">
              <ShieldCheck className="w-6 h-6 text-violet-600 shrink-0 mt-0.5" />
              <p className="text-violet-900 font-medium">
                Pulse provides booking infrastructure for independent businesses. We act as a service provider (Processor) while the business owner remains the Custodian and Controller of all client records.
              </p>
            </div>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-violet-500" /> 1. Data Ownership &amp; Privacy
              </h2>
              <div className="space-y-3">
                <p><strong>Business Data:</strong> All client records, appointment history, and business-specific data are owned exclusively by the Business Owner (the &quot;Subscriber&quot;). Pulse does not claim any ownership rights to your data.</p>
                <p><strong>Compliance:</strong> For users in Alberta, Canada, Pulse serves as an &quot;Information Manager&quot; under the <em>Health Information Act</em> (HIA) and a &quot;Processor&quot; under the <em>Personal Information Protection Act</em> (PIPA). Businesses are responsible for their own Privacy Impact Assessments (PIA) as required by the OIPC.</p>
                <p><strong>Portability:</strong> You may export your data at any time. We do not hold your data hostage or charge exit fees for your records.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-violet-500" /> 2. Payments &amp; Fee Transparency
              </h2>
              <div className="space-y-3">
                <p><strong>Provider Fees:</strong> Pulse charges a monthly or per-feature subscription fee to business subscribers. This fee is separate from Stripe payment-processing fees.</p>
                <p><strong>Processing Fees:</strong> Transaction fees are determined by Stripe. Pulse does not control these fees and they are deducted directly by Stripe during each transaction.</p>
                <p><strong>Security:</strong> Pulse is PCI DSS compliant by design. We never store raw credit card numbers or CVVs on our servers. All sensitive payment data is tokenized by Stripe.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-violet-500" /> 3. Client Payment Authorization &amp; Card on File
              </h2>
              <div className="space-y-3">
                <p>This section applies to clients (end customers) who book appointments through a business using Pulse.</p>
                <p><strong>Booking Deposits:</strong> Some businesses require a deposit at the time of booking. If a deposit is required, the amount and percentage will be clearly disclosed before you confirm your booking. By completing checkout, you authorize that deposit charge.</p>
                <p><strong>Card on File:</strong> Some businesses request that you save a payment method (credit or debit card) on file via Stripe&apos;s secure system. By providing your card details and agreeing to save them, you authorize that business to charge your card for: (a) deposits collected at booking; (b) no-show fees if you miss an appointment without cancelling; and (c) late-cancellation fees if you cancel within the business&apos;s stated cancellation window. The specific fee amounts will be disclosed by the business at the time of booking. Pulse facilitates these charges on behalf of the business but does not determine the fee amounts.</p>
                <p><strong>Removing a Saved Card:</strong> You may remove your saved payment method at any time by visiting your client portal at <strong>pulseappointments.com/my/dashboard</strong> or by contacting the business directly. Removing your card does not cancel any existing bookings.</p>
                <p><strong>Disputes:</strong> If you believe you have been incorrectly charged, contact the business first. If the issue is not resolved, you may contact Pulse support at support@pulseappointments.com or dispute the charge through your card issuer.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-violet-500" /> 4. Notifications
              </h2>
              <div className="space-y-3">
                <p><strong>Transactional Notifications:</strong> Pulse sends booking confirmations, reminders, cancellation notices, and client message alerts via email, SMS, and push notifications. These are necessary for the core operation of the service.</p>
                <p><strong>Push Notification Opt-Out:</strong> You may enable or disable push notifications at any time through your device&apos;s <strong>Settings → Notifications → Pulse</strong>. Disabling push notifications will not affect email or SMS notifications you may have separately opted into.</p>
                <p><strong>SMS Opt-Out:</strong> To stop receiving SMS notifications from a business on Pulse, reply STOP to any message from that business, or contact the business directly.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-violet-500" /> 5. Mobile Application
              </h2>
              <div className="space-y-3">
                <p>The Pulse iOS and Android apps are tools for business owners and staff to manage appointments, clients, and payments. By downloading and using the app, you agree to these Terms and our Privacy Policy.</p>
                <p><strong>In-App Purchases:</strong> The Pulse iOS app does not offer subscription upgrades or in-app purchases through the Apple App Store. Subscription plan management is available on the web at <strong>pulseappointments.com/dashboard/settings</strong>. In-person client payment processing through the app uses Stripe&apos;s native payment sheet and is exempt from in-app purchase requirements as it processes payments for physical services rendered outside the device.</p>
                <p><strong>Apple Platform:</strong> Apple Inc. is not a party to these Terms and has no responsibility for the Pulse app or its content. In the event of any conflict between these Terms and Apple&apos;s App Store Terms of Service, Apple&apos;s terms govern your use of the App Store.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-violet-500" /> 6. Liability &amp; Indemnification
              </h2>
              <div className="space-y-3">
                <p><strong>Limitation of Liability:</strong> To the maximum extent permitted by Alberta law, Pulse is not liable for indirect, incidental, or consequential damages, including lost profits or data loss resulting from your use of the service.</p>
                <p><strong>Indemnification:</strong> You agree to defend, indemnify, and hold harmless Pulse from any legal claims, damages, or costs (including lawyer fees) arising from your misuse of the platform, violation of privacy laws, or disputes with your clients.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-violet-500" /> 7. Governing Law &amp; Arbitration
              </h2>
              <div className="space-y-3">
                <p><strong>Jurisdiction:</strong> These Terms are governed by the laws of the Province of Alberta and the federal laws of Canada applicable therein.</p>
                <p><strong>Dispute Resolution:</strong> Any disputes arising from these Terms shall be resolved through individual binding arbitration in <strong>Calgary, Alberta</strong>, rather than in court. You waive any right to participate in class actions or class-wide arbitration.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4">8. Account Suspension</h2>
              <p>Pulse reserves the right to suspend or terminate any account that violates Stripe&apos;s Services Agreement, engages in fraudulent activity, harasses clients, or fails to comply with local privacy regulations.</p>
            </section>

            <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-400">© 2026 Pulse Appointments. All rights reserved.</p>
              <div className="flex gap-6">
                <Link href="/privacy" className="text-violet-600 font-semibold hover:underline">Privacy Policy</Link>
                <Link href="mailto:support@pulseappointments.com" className="text-violet-600 font-semibold hover:underline">Support</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
