import Link from "next/link";
import { ShieldCheck, Scale, Database, CreditCard, AlertCircle, Bell, Smartphone, FileText, Users, Cpu, RefreshCcw, Star } from "lucide-react";

export const metadata = { title: "Terms of Service — Pulse" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Booking</span>
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
              <h2 className="text-lg font-bold text-slate-900 mb-4">8. Account Suspension &amp; Acceptable Use</h2>
              <div className="space-y-3">
                <p>Pulse reserves the right to suspend or terminate any account that violates Stripe&apos;s Services Agreement, engages in fraudulent activity, harasses clients, or fails to comply with local privacy regulations.</p>
                <p><strong>Eligible Businesses:</strong> Pulse is a service scheduling platform for legitimate in-person service businesses. The following are prohibited: illegal businesses or services, businesses engaged in regulated financial services (without proper licensing), adult-only services (where prohibited by law), businesses that facilitate illegal transactions, and businesses on Stripe&apos;s prohibited categories list.</p>
                <p><strong>Prohibited Conduct:</strong> You may not: use Pulse to send unsolicited commercial messages beyond CASL-permitted purposes; scrape, reverse-engineer, or build competing booking products using Pulse&apos;s infrastructure; share login credentials or allow unauthorized account access; or use the platform to store data for purposes unrelated to appointment booking and client management.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-violet-500" /> 9. Eligibility &amp; Age Requirement
              </h2>
              <p>Pulse business accounts are available to individuals who are at least 18 years of age and legally capable of entering into contracts. By creating a business account, you confirm that you meet this requirement. You are responsible for ensuring that any staff members added to your account also comply with these Terms.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-violet-500" /> 10. Intellectual Property
              </h2>
              <div className="space-y-3">
                <p><strong>Pulse Platform:</strong> The Pulse platform, including its software, design, trademarks, and documentation, is owned exclusively by Pulse Appointments Inc. and is protected by Canadian copyright law and international intellectual property agreements. You are granted a limited, non-exclusive, non-transferable licence to use the platform for your business operations during your active subscription.</p>
                <p><strong>Your Content:</strong> You retain full ownership of all content you upload or create through Pulse — including your business name, logo, service descriptions, and client data. By uploading content, you grant Pulse a limited licence to store, process, and display that content solely to provide the service.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-violet-500" /> 11. Service Availability
              </h2>
              <p>Pulse targets high availability but does not guarantee uninterrupted access to the platform. We do not provide a formal Service Level Agreement (SLA) with uptime guarantees. Scheduled maintenance, third-party infrastructure outages (including Railway, Stripe, and cloud providers), and events outside our control may result in temporary unavailability. Pulse is not liable for losses resulting from service interruptions.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-violet-500" /> 12. Subscription Fees &amp; Refunds
              </h2>
              <div className="space-y-3">
                <p><strong>Billing:</strong> Subscription fees are billed monthly or annually in advance, depending on the plan you select. Fees are non-refundable once billed, except where required by applicable law.</p>
                <p><strong>Cancellations:</strong> You may cancel your subscription at any time through <strong>Settings → Billing</strong>. Your access will continue until the end of the current billing period. We do not provide partial refunds for unused time.</p>
                <p><strong>Exceptions:</strong> If you believe you were charged in error, contact support@pulseappointments.com within 14 days of the charge. We will review and issue a refund if the charge was made in error.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-violet-500" /> 13. Data on Cancellation
              </h2>
              <div className="space-y-3">
                <p>When you cancel your subscription, your account enters a 90-day data retention window. During this period, you may re-activate your account or export your data at any time through <strong>Settings → Data Export</strong>.</p>
                <p>After 90 days, your account and associated business data (client records, appointment history, staff profiles) will be permanently deleted, subject to legal retention requirements for financial records (see our Privacy Policy, Section 7).</p>
                <p>If you need an extension to the 90-day window for data export purposes, contact support@pulseappointments.com before the window expires.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <RefreshCcw className="w-5 h-5 text-violet-500" /> 14. Changes to These Terms
              </h2>
              <div className="space-y-3">
                <p>Pulse may update these Terms at any time. We will provide at least <strong>14 days&apos; advance notice</strong> of material changes by email to your registered email address and by displaying a notice in the dashboard.</p>
                <p>Your continued use of Pulse after the effective date of updated Terms constitutes your acceptance of the changes. If you do not agree to the updated Terms, you may cancel your subscription before the effective date.</p>
                <p>The &quot;Last updated&quot; date at the top of this page reflects the most recent version. We maintain an archive of prior versions — contact support@pulseappointments.com to request a previous version.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-violet-500" /> 15. Contact
              </h2>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-xs space-y-0.5">
                <p className="font-semibold text-slate-700">Pulse Appointments Inc.</p>
                <p>Suite 500 — 999 8th Street SW, Calgary, Alberta T2R 1J5, Canada</p>
                <p>Email: <strong>support@pulseappointments.com</strong></p>
                <p>Legal enquiries: <strong>legal@pulseappointments.com</strong></p>
              </div>
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
