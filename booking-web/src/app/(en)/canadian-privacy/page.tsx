import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import Link from "next/link";
import { ShieldCheck, Bell, Database, FileText, Globe, Users } from "lucide-react";

export const metadata: Metadata = {
  alternates: buildAlternates("/canadian-privacy"),
  title: "Canadian Privacy | Pulse Appointments",
  description: "How Pulse Appointments complies with PIPEDA, Alberta PIPA, and CASL. Data residency, consent, and health information practices for Canadian businesses.",
  openGraph: { title: "Canadian Privacy | Pulse Appointments", description: "PIPEDA, PIPA, and CASL compliance for Canadian service businesses." },
};

export default function CanadianPrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Appointments</span>
        </Link>

        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 py-1 text-xs font-medium text-red-700 mb-4">
            <span>🇨🇦</span> Canada-first
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Canadian Privacy</h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Pulse is built for Canadian service businesses. This page explains how we handle data under
            Canada&apos;s federal and provincial privacy laws, our CASL obligations, and what you
            should know if your practice handles health information.
          </p>
        </div>

        <div className="space-y-6">

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">PIPEDA (Federal — Private Sector Privacy Act)</h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-3">
                  The <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA) applies to
                  federally regulated organizations and to provincial organizations that collect, use, or disclose
                  personal information in the course of commercial activity.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mb-3">
                  Pulse is designed around the 10 fair information principles in PIPEDA Schedule 1:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600 mb-3">
                  <li><strong>Accountability</strong> — Pulse designates a Privacy Officer responsible for compliance.</li>
                  <li><strong>Identifying Purposes</strong> — We collect data only for stated, specific purposes.</li>
                  <li><strong>Consent</strong> — We obtain and record express or implied consent before collecting personal information.</li>
                  <li><strong>Limiting Collection</strong> — We collect only what is necessary for the purpose.</li>
                  <li><strong>Limiting Use, Disclosure, and Retention</strong> — Data is not sold. Retention periods are documented.</li>
                  <li><strong>Accuracy</strong> — Businesses and clients can correct their information at any time.</li>
                  <li><strong>Safeguards</strong> — Encryption, access controls, audit logs, and breach monitoring. See our <Link href="/security" className="text-violet-600 hover:underline">Security page</Link>.</li>
                  <li><strong>Openness</strong> — Our policies are publicly available.</li>
                  <li><strong>Individual Access</strong> — Users can access, correct, or request deletion of their data.</li>
                  <li><strong>Challenging Compliance</strong> — Contact us at <Link href="mailto:privacy@pulseappointments.com" className="text-violet-600 hover:underline">privacy@pulseappointments.com</Link> with any concerns.</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">Alberta PIPA</h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-3">
                  The <em>Personal Information Protection Act</em> (PIPA) applies to private-sector organizations operating in Alberta.
                  Alberta&apos;s PIPA is substantially similar to PIPEDA. Pulse complies with PIPA obligations for Alberta-based businesses
                  using our platform, including the requirement to notify the Office of the Information and Privacy Commissioner of Alberta
                  of breaches involving significant harm.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">CASL (Canada&apos;s Anti-Spam Legislation)</h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-3">
                  CASL requires express or implied consent before sending commercial electronic messages (CEM).
                  Pulse supports CASL compliance in the following ways:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 mb-3">
                  <li>Marketing emails and SMS require client consent. Pulse records whether a client has opted in to marketing messages.</li>
                  <li>Every marketing message includes a one-click unsubscribe link. Unsubscribe requests are processed immediately.</li>
                  <li>Transactional messages (booking confirmations, reminders, receipts) are CASL-exempt as they directly relate to an existing commercial relationship.</li>
                  <li>Consent records include the date, method, and IP address of consent — available in your dashboard for audit purposes.</li>
                  <li>Implied consent applies for existing clients for 2 years after their last transaction (CASL Section 10(9)(a)).</li>
                </ul>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Businesses are responsible for ensuring their own marketing campaigns sent through Pulse comply with CASL.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">Data residency and cross-border transfers</h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-3">
                  Pulse&apos;s servers are hosted on Railway&apos;s infrastructure, which may be located in the United States.
                  Cross-border data transfers are permitted under PIPEDA Schedule 1 Principle 7 when equivalent protections are in place.
                  Railway is a SOC 2 Type II certified provider.
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  If your business requires Canadian data residency (e.g., for regulated health professions), please contact us at
                  {" "}<Link href="mailto:privacy@pulseappointments.com" className="text-violet-600 hover:underline">privacy@pulseappointments.com</Link>{" "}
                  to discuss your requirements.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">Health information (massage therapists, estheticians, and health-adjacent professionals)</h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-3">
                  PIPEDA applies to health information collected by private-sector organizations in provinces without substantially similar
                  legislation. If your business collects health information (e.g., skin conditions, medical history, allergy information) via
                  intake forms or client notes, you have additional obligations:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 mb-3">
                  <li>Obtain informed consent before collecting health information.</li>
                  <li>Use health information only for the stated purpose (e.g., service delivery).</li>
                  <li>Do not use client health information for marketing without separate, express consent.</li>
                  <li>Health information must be retained only as long as necessary and securely deleted when no longer needed.</li>
                </ul>
                <p className="text-sm text-slate-600 leading-relaxed">
                  <strong>Note for regulated health professionals:</strong> If your practice is regulated under provincial health legislation
                  (e.g., regulated massage therapists in Ontario under RHPA), sector-specific legislation may apply in addition to PIPEDA.
                  Pulse does not constitute an Electronic Health Records (EHR) system and is not intended for use in highly regulated clinical settings.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">Your rights as a Canadian individual</h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-3">
                  Under PIPEDA, individuals have the right to:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 mb-3">
                  <li>Know that an organization holds information about them and how it is used.</li>
                  <li>Access their personal information (within 30 days of a written request).</li>
                  <li>Correct inaccurate information.</li>
                  <li>Withdraw consent for use of their information (subject to legal and business obligations).</li>
                  <li>Complain to the Office of the Privacy Commissioner of Canada (OPC) if they believe their rights have been violated.</li>
                </ul>
                <p className="text-sm text-slate-600 leading-relaxed">
                  To exercise any of these rights, email{" "}
                  <Link href="mailto:privacy@pulseappointments.com" className="text-violet-600 hover:underline">privacy@pulseappointments.com</Link>.
                  Client accounts can also submit a data deletion request from the client portal under Settings.
                </p>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-10 rounded-2xl border border-violet-200 bg-violet-50 p-6">
          <h2 className="text-base font-semibold text-violet-900 mb-2">Questions about Canadian privacy compliance?</h2>
          <p className="text-sm text-violet-800 mb-3">
            We are happy to speak with business owners, privacy officers, or legal counsel about our privacy practices.
          </p>
          <Link href="mailto:privacy@pulseappointments.com" className="text-sm font-semibold text-violet-700 hover:text-violet-800 underline">
            privacy@pulseappointments.com
          </Link>
        </div>

        <p className="text-xs text-slate-400 mt-8 text-center">
          Last reviewed: June 2026 ·{" "}
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>{" "}·{" "}
          <Link href="/security" className="hover:underline">Security</Link>{" "}·{" "}
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}
