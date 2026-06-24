import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ShieldCheck, Eye, Server, CreditCard, Key, Bell, FileText, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Security | Pulse Appointments",
  description: "How Pulse Appointments protects your business data and your clients' information. Encryption, access controls, PIPEDA compliance, and responsible disclosure.",
  openGraph: { title: "Security | Pulse Appointments", description: "Enterprise-grade security for Canadian service businesses." },
};

const sections = [
  {
    icon: Lock,
    title: "Encryption in transit and at rest",
    body: "All data transmitted to and from Pulse is encrypted using TLS 1.3. Data stored in our database is encrypted at rest using AES-256. Backups are also encrypted.",
  },
  {
    icon: Key,
    title: "Password security",
    body: "Passwords are hashed with bcrypt (cost factor 12) before storage. Pulse never stores plaintext passwords. Password reset tokens are single-use and expire in 15 minutes.",
  },
  {
    icon: ShieldCheck,
    title: "Two-factor authentication",
    body: "All user accounts can enable two-factor authentication (2FA) via email or SMS. Business owners are encouraged to enable 2FA on initial setup. Recovery codes are provided at enrollment.",
  },
  {
    icon: Eye,
    title: "Audit logging",
    body: "Security-relevant actions — logins, password changes, staff changes, permission updates, and data exports — are written to a tamper-evident audit log accessible to business owners.",
  },
  {
    icon: Bell,
    title: "Login alerts",
    body: "When a sign-in occurs from a new device or IP address, we send an immediate security alert email. The alert includes a one-click password reset link so you can lock your account if it wasn't you.",
  },
  {
    icon: Server,
    title: "Infrastructure",
    body: "Pulse runs on Railway, a SOC 2 Type II certified cloud platform. Our database is hosted on a managed PostgreSQL service with automated backups, point-in-time recovery, and network isolation.",
  },
  {
    icon: CreditCard,
    title: "PCI compliance via Stripe",
    body: "Pulse does not store credit card numbers, CVVs, or full payment details. All card processing is handled by Stripe, a PCI DSS Level 1 certified payment processor. Pulse receives only tokenized references.",
  },
  {
    icon: FileText,
    title: "Canadian privacy (PIPEDA)",
    body: "Pulse is designed for Canadian businesses and built around PIPEDA Schedule 1 obligations — including purpose limitation, data minimization, safeguards, and breach notification. See our Canadian Privacy page for details.",
    link: { href: "/canadian-privacy", label: "Read our Canadian Privacy page" },
  },
  {
    icon: Bell,
    title: "Breach notification",
    body: "In the event of a confirmed data breach affecting your business, Pulse will notify affected businesses and clients in accordance with PIPEDA's mandatory breach reporting requirements (within 72 hours of determination).",
  },
  {
    icon: Mail,
    title: "Responsible disclosure",
    body: "Security researchers who discover a vulnerability in Pulse are encouraged to report it responsibly. We commit to acknowledging reports within 2 business days and to not pursuing legal action against good-faith disclosures.",
    link: { href: "mailto:security@pulseappointments.com", label: "security@pulseappointments.com" },
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Appointments</span>
        </Link>

        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Security</h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Protecting your business data and your clients&apos; information is foundational to everything Pulse does.
            Here is how we keep your data safe.
          </p>
        </div>

        <div className="space-y-4">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 mb-1">{s.title}</h2>
                    <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
                    {"link" in s && s.link && (
                      <Link href={s.link.href} className="inline-block mt-2 text-sm font-medium text-violet-600 hover:underline">
                        {s.link.label} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-violet-200 bg-violet-50 p-6">
          <h2 className="text-base font-semibold text-violet-900 mb-2">Questions about our security practices?</h2>
          <p className="text-sm text-violet-800 mb-3">
            We are happy to answer questions from business owners, enterprise buyers, or privacy officers.
          </p>
          <Link href="mailto:security@pulseappointments.com" className="inline-block text-sm font-semibold text-violet-700 hover:text-violet-800 underline">
            security@pulseappointments.com
          </Link>
        </div>

        <p className="text-xs text-slate-400 mt-8 text-center">
          Last reviewed: June 2026 ·{" "}
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>{" "}·{" "}
          <Link href="/canadian-privacy" className="hover:underline">Canadian Privacy</Link>{" "}·{" "}
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}
