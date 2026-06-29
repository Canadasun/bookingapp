import Link from "next/link";
import { buildAlternates } from "@/lib/hreflang";
import { Database, Eye, Lock, Mail, Scale, Share2, ShieldCheck, Trash2 } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Pulse Appointments",
  alternates: buildAlternates("/privacy"),
};

const sections = [
  {
    icon: Eye,
    title: "1. Information we collect",
    content: (
      <div className="space-y-3">
        <p><strong>Account and business information:</strong> names, business details, email addresses, phone numbers, locations, staff profiles, login and security settings.</p>
        <p><strong>Booking and client information:</strong> appointment details, services, notes, intake answers, contact details, preferences, messages, reviews, invoices, and transaction references entered by a business or client.</p>
        <p><strong>Technical information:</strong> IP address, browser or app type, device information, timezone, login events, cookies, diagnostics, and security logs.</p>
        <p><strong>Payment information:</strong> Stripe collects card and banking details directly. Pulse receives limited identifiers, status, amount, and transaction records, but does not store complete card numbers or security codes.</p>
      </div>
    ),
  },
  {
    icon: Database,
    title: "2. How we use information",
    content: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Provide accounts, online booking, scheduling, reminders, messaging, payments, reporting, support, and related platform functions.</li>
        <li>Authenticate users, prevent fraud and abuse, investigate incidents, and protect the platform.</li>
        <li>Process subscriptions and transactions, maintain financial records, and meet legal obligations.</li>
        <li>Improve reliability and usability using diagnostics and aggregated information.</li>
        <li>Send service communications. Marketing email or SMS is sent only where permitted by Canada&apos;s anti-spam legislation, and includes an unsubscribe method where required.</li>
      </ul>
    ),
  },
  {
    icon: Scale,
    title: "3. Business and platform responsibilities",
    content: (
      <div className="space-y-3">
        <p>Pulse operates from Alberta and handles personal information under applicable Canadian privacy laws, including Alberta&apos;s <em>Personal Information Protection Act</em> (PIPA) and, where applicable, the federal <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA).</p>
        <p>Businesses using Pulse decide what client information to collect and why. Each business is responsible for its notices, consents, lawful use, staff access, retention requirements, and any industry-specific obligations. Pulse processes that information to provide the services requested by the business.</p>
        <p>Pulse is not a health-information custodian merely because a business enters appointment or intake information. Regulated providers remain responsible for determining whether health-sector laws apply and for entering any required information-management agreement.</p>
      </div>
    ),
  },
  {
    icon: Share2,
    title: "4. Service providers and disclosure",
    content: (
      <div className="space-y-3">
        <p>We do not sell personal information. We disclose information only as needed to operate Pulse, complete a user&apos;s request, protect rights and safety, complete a business transaction, or comply with law.</p>
        <p>Providers may include Stripe for payments, Twilio for SMS, Resend for email, Expo and device-platform services for push notifications, Railway and other infrastructure providers for hosting, Sentry for error monitoring, and carefully limited analytics or AI providers where enabled. These providers may process information outside Alberta or Canada, where it may be subject to foreign law.</p>
        <p>Businesses and their authorized staff can access their own client records. Clients should contact the relevant business first about records controlled by that business.</p>
      </div>
    ),
  },
  {
    icon: Lock,
    title: "5. Security",
    content: (
      <div className="space-y-3">
        <p>We use administrative, technical, and physical safeguards appropriate to the sensitivity of the information, including encrypted network connections, password hashing, access controls, monitoring, backups, and optional two-factor authentication.</p>
        <p>No internet service can guarantee absolute security. Users must protect credentials, enable two-factor authentication, restrict staff access, and notify us promptly of suspected unauthorized use.</p>
        <p>Where a privacy breach creates a real risk of significant harm or otherwise requires notice, we will investigate, keep required records, and notify affected people and regulators as required by applicable law.</p>
      </div>
    ),
  },
  {
    icon: Trash2,
    title: "6. Retention, access, and deletion",
    content: (
      <div className="space-y-3">
        <p>We retain information only as long as reasonably needed for the purposes described here, an active account, backup and dispute cycles, fraud prevention, and legal, tax, accounting, or regulatory requirements. Retention periods vary by record type.</p>
        <p>You may ask to access or correct personal information held by Pulse, withdraw consent where processing depends on consent, or request deletion. Some information cannot be deleted immediately where retention is legally required, needed to complete a transaction, protect legal rights, or contained in secured backups pending normal deletion.</p>
        <p>Requests may require identity verification. We aim to respond within the period required by applicable law. Client-record requests may be referred to the business that controls those records.</p>
      </div>
    ),
  },
  {
    icon: Mail,
    title: "7. Cookies, communications, and choices",
    content: (
      <div className="space-y-3">
        <p>Pulse uses necessary cookies for authentication, security, preferences, and core operation. Optional analytics are used according to the consent choices presented on the site.</p>
        <p>Appointment confirmations, receipts, security alerts, and account notices are service messages. You can change optional business notifications in settings, use the unsubscribe link in marketing messages, or contact the sender. Device push notifications can be disabled in device settings.</p>
      </div>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F8F5EF] px-5 py-12 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse Appointments" className="h-9 w-9 object-contain" />
          <span className="text-xl font-bold tracking-tight text-slate-950">Pulse Appointments</span>
        </Link>

        <article className="overflow-hidden rounded-[2rem] border border-amber-900/10 bg-white shadow-xl shadow-amber-950/5">
          <header className="bg-slate-950 px-7 py-10 text-white sm:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Legal</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
            <p className="mt-3 text-sm text-slate-300">Effective June 13, 2026 · Calgary, Alberta, Canada</p>
          </header>

          <div className="space-y-10 px-7 py-9 text-sm leading-7 text-slate-600 sm:px-12 sm:py-12">
            <div className="flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
              <p>Pulse Appointments is operated by <strong>Idowu Ayeni</strong>. This policy explains how Pulse collects, uses, discloses, protects, and retains personal information when businesses and clients use our website, mobile applications, booking pages, and related services.</p>
            </div>

            {sections.map(({ icon: Icon, title, content }) => (
              <section key={title}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><Icon className="h-5 w-5 text-amber-600" />{title}</h2>
                {content}
              </section>
            ))}

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">8. Children and international users</h2>
              <div className="space-y-3">
                <p>Business accounts are not intended for anyone under 18. A business may accept bookings for a minor where the parent, guardian, or business has the authority and consent required by law.</p>
                <p>Users outside Canada understand that information may be processed in Canada and other countries where our providers operate. Local rights may also apply.</p>
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">9. Changes and contact</h2>
              <div className="space-y-3">
                <p>We may update this policy as Pulse, our providers, or legal requirements change. Material changes will be communicated through the service or by email where appropriate. The effective date above identifies the current version.</p>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm">
                  <p className="font-bold text-slate-900">Privacy Officer: Idowu Ayeni</p>
                  <p>Pulse Appointments</p>
                  <p>3 St. SE, Calgary, Alberta T2G 0T9, Canada</p>
                  <p>Email: <a className="font-semibold text-amber-700 hover:underline" href="mailto:support@pulseappointments.com">support@pulseappointments.com</a></p>
                </div>
                <p>If we cannot resolve a privacy concern, you may contact the Office of the Information and Privacy Commissioner of Alberta or the Office of the Privacy Commissioner of Canada, as applicable.</p>
              </div>
            </section>

            <footer className="flex flex-col gap-4 border-t border-slate-100 pt-7 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">Pulse Appointments · Calgary, Alberta</p>
              <div className="flex gap-5 font-semibold text-amber-700"><Link href="/terms" className="hover:underline">Terms of Service</Link><Link href="/" className="hover:underline">Home</Link></div>
            </footer>
          </div>
        </article>
      </div>
    </main>
  );
}
