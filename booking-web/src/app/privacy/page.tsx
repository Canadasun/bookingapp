import Link from "next/link";
import { Calendar, ShieldCheck, Lock, Eye, Share2, Scale, Smartphone, Trash2, Bell } from "lucide-react";

export const metadata = { title: "Privacy Policy — Pulse" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          <Calendar className="w-8 h-8 text-violet-600" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse</span>
        </Link>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-violet-600 px-8 py-10 text-white">
            <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
            <p className="text-violet-100 text-sm">Last updated: June 8, 2026 · Calgary, Alberta</p>
          </div>

          <div className="p-8 md:p-12 space-y-10 text-sm text-slate-600 leading-relaxed">
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-6 flex gap-4 italic text-slate-500">
              <ShieldCheck className="w-6 h-6 text-slate-400 shrink-0 mt-0.5" />
              <p>
                Pulse is built on a &quot;Privacy First&quot; foundation. We provide the tools for your business, but you control the data. This policy explains our commitment to protecting information for both businesses and their clients.
              </p>
            </div>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-violet-500" /> 1. Roles &amp; Responsibility (HIA/PIPA)
              </h2>
              <div className="space-y-3">
                <p><strong>Business Owners (Controllers):</strong> You are the &quot;Custodian&quot; or &quot;Controller&quot; of your clients&apos; personal and health information. You are responsible for obtaining necessary consents and complying with Alberta&apos;s <em>Health Information Act</em> (HIA) or <em>Personal Information Protection Act</em> (PIPA).</p>
                <p><strong>Pulse (Processor):</strong> We act as your &quot;Information Manager&quot; or &quot;Processor.&quot; We only access your data to provide technical support or deliver the services you have authorized (e.g., sending a booking reminder).</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-violet-500" /> 2. Information We Collect
              </h2>
              <div className="space-y-3">
                <p><strong>Account Data:</strong> We collect your name, business name, email address, and phone number to manage your account and authenticate your access.</p>
                <p><strong>Service Data:</strong> This includes appointments, service lists, intake form answers, and client contact details. We process this data solely to provide the booking platform features.</p>
                <p><strong>Usage Data:</strong> We collect technical data including IP addresses, browser or app version, and device timezone (used to display appointment times accurately in your local time) to improve platform stability and security.</p>
                <p><strong>Push Notification Tokens:</strong> When you allow push notifications on the Pulse mobile app, we collect a device-specific push notification token issued by Apple (APN) or Google (FCM). This token is stored on our servers, linked to your account, and used solely to deliver booking alerts, client messages, and appointment reminders to your device. We do not use this token for advertising. You can revoke this at any time by disabling Pulse notifications in your device Settings.</p>
                <p><strong>Biometric Authentication:</strong> The Pulse iOS app offers Face ID or Touch ID as a convenience to unlock the app. Biometric authentication is processed entirely on your device using Apple&apos;s secure operating system APIs. Pulse does not receive, store, or transmit any biometric data.</p>
                <p><strong>Payment Data:</strong> All payment information (card numbers, banking details) is collected and tokenized directly by Stripe. Pulse never sees or stores raw card numbers or CVVs. We store Stripe customer and account identifiers to associate payments with the correct business or client account.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-violet-500" /> 3. Data Security &amp; Residency
              </h2>
              <div className="space-y-3">
                <p><strong>Encryption:</strong> All data is encrypted at rest and in transit using industry-standard AES-256 encryption. Passwords are never stored in plain text.</p>
                <p><strong>Data Residency:</strong> For our Canadian subscribers, we prioritize storage in Canadian data centers to align with provincial privacy recommendations.</p>
                <p><strong>PCI Compliance:</strong> Payment information is tokenized and handled entirely by Stripe. Pulse never sees or stores full credit card numbers.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-violet-500" /> 4. Data Sharing &amp; Sub-Processors
              </h2>
              <div className="space-y-3">
                <p>We do not sell, rent, or trade your data. We only share information with sub-processors essential to the service:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Stripe</strong> (stripe.com) — Secure payment processing, subscription billing, and Stripe Connect payouts.</li>
                  <li><strong>Twilio</strong> (twilio.com) — SMS notification delivery to clients and businesses.</li>
                  <li><strong>Resend</strong> (resend.com) — Transactional email delivery (booking confirmations, reminders).</li>
                  <li><strong>Expo</strong> (expo.dev) — Push notification delivery infrastructure. When a push notification is sent from our servers, it is routed through Expo&apos;s notification service, which in turn delivers it via Apple&apos;s APN (for iOS) or Google&apos;s FCM (for Android). Expo does not retain notification content after delivery.</li>
                  <li><strong>Google Cloud</strong> (cloud.google.com) — Secure infrastructure and hosting.</li>
                  <li><strong>OpenAI</strong> (openai.com) — Used for AI-powered admin analytics features (no personal client data is sent; only aggregated error categories).</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-violet-500" /> 5. Push Notifications
              </h2>
              <div className="space-y-3">
                <p>The Pulse mobile app may send push notifications for: new booking requests, booking confirmations or cancellations, client messages, and appointment reminders. These are transactional notifications required for the core function of the service.</p>
                <p>You may enable or disable push notifications at any time through your device&apos;s <strong>Settings → Notifications → Pulse</strong>. Disabling notifications will not affect your ability to use the app; you will still see alerts within the app itself.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-violet-500" /> 6. Mobile App &amp; Device Permissions
              </h2>
              <div className="space-y-3">
                <p><strong>Camera:</strong> Used only to scan payment cards at checkout. Camera images are processed on-device and are not uploaded to Pulse servers.</p>
                <p><strong>Photo Library:</strong> Used only when you choose to upload a business logo or profile image. Photos are uploaded to Pulse&apos;s secure file storage and linked to your account.</p>
                <p><strong>Face ID / Touch ID:</strong> Used optionally as a local lock screen to secure app access. No biometric data leaves your device.</p>
                <p><strong>Advertising Identifier (IDFA):</strong> Pulse does not access, collect, or use the device Advertising Identifier. No advertising SDKs or tracking is present in the app.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-violet-500" /> 7. Data Retention &amp; Deletion
              </h2>
              <div className="space-y-3">
                <p><strong>Retention:</strong> We retain your account data for as long as your account is active or as needed to provide the service. <em>Financial transaction records</em> (invoices, payment confirmations, payout records) are retained for a minimum of 7 years to comply with the Canada Revenue Agency&apos;s record-keeping requirements under the <em>Income Tax Act</em> and <em>Excise Tax Act</em>. <em>Personal contact data</em> (names, emails, phone numbers) associated with inactive accounts is deleted or anonymized within 2 years of account closure, unless a longer period is required by law or you have an active legal dispute with a business on the platform.</p>
                <p><strong>Deletion:</strong> You have the right to request deletion of your personal data. To submit a deletion request, email <strong>support@pulseappointments.com</strong> with the subject line &quot;Data Deletion Request.&quot; We will process your request within 30 days and confirm when your data has been deleted. Note that some data may be retained where required by law (e.g., financial transaction records).</p>
                <p><strong>Account Closure:</strong> When you close your Pulse account, your business data and client records are queued for deletion within 90 days, subject to legal retention requirements.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-violet-500" /> 8. Data Breach Notification
              </h2>
              <p>In the event of a data breach that compromises personal information collected through Pulse, we will notify affected users as soon as reasonably practicable and no later than 72 hours after becoming aware of the breach, in accordance with applicable law and our obligations under the Apple Developer Program License Agreement. Notification will be provided by email to your registered email address.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-violet-500" /> 9. Your Rights (PIPA / Alberta)
              </h2>
              <div className="space-y-3">
                <p>Under Alberta&apos;s <em>Personal Information Protection Act</em> (PIPA), you have the right to access the personal information we hold about you, request corrections, and withdraw consent for non-essential processing.</p>
                <p><strong>Privacy Officer:</strong> Pulse has designated a Privacy Officer responsible for handling data requests and PIPA compliance inquiries.</p>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-xs space-y-0.5">
                  <p className="font-semibold text-slate-700">Privacy Officer, Pulse Appointments</p>
                  <p>Email: <strong>privacy@pulseappointments.com</strong></p>
                  <p>Mailing Address: Pulse Appointments Inc., Privacy Officer</p>
                  <p>Suite 500 — 999 8th Street SW, Calgary, Alberta T2R 1J5, Canada</p>
                </div>
                <p>If you are unsatisfied with our response, you may file a complaint with the <strong>Office of the Information and Privacy Commissioner of Alberta (OIPC)</strong> at <strong>www.oipc.ab.ca</strong>.</p>
              </div>
            </section>

            <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-400">Questions? support@pulseappointments.com</p>
              <div className="flex gap-6">
                <Link href="/terms" className="text-violet-600 font-semibold hover:underline">Terms of Service</Link>
                <Link href="/" className="text-violet-600 font-semibold hover:underline">Home</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
