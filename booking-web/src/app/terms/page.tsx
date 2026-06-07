import Link from "next/link";
import { Calendar, ShieldCheck, Scale, Database, CreditCard, AlertCircle } from "lucide-react";

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
            <p className="text-slate-400 text-sm">Last updated: June 6, 2026 · Calgary, Alberta</p>
          </div>

          <div className="p-8 md:p-12 space-y-10 text-sm text-slate-600 leading-relaxed">
            <div className="rounded-2xl bg-violet-50 border border-violet-100 p-6 flex gap-4">
              <ShieldCheck className="w-6 h-6 text-violet-600 shrink-0" />
              <p className="text-violet-900 font-medium">
                Pulse provides booking infrastructure for independent businesses. We act as a service provider (Processor) while the business owner remains the Custodian and Controller of all client records.
              </p>
            </div>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-violet-500" /> 1. Data Ownership & Privacy
              </h2>
              <div className="space-y-3">
                <p><strong>Business Data:</strong> All client records, appointment history, and business-specific data are owned exclusively by the Business Owner (the &quot;Subscriber&quot;). Pulse does not claim any ownership rights to your data.</p>
                <p><strong>Compliance:</strong> For users in Alberta, Canada, Pulse serves as an &quot;Information Manager&quot; under the <em>Health Information Act</em> (HIA) and a &quot;Processor&quot; under the <em>Personal Information Protection Act</em> (PIPA). Businesses are responsible for their own Privacy Impact Assessments (PIA) as required by the OIPC.</p>
                <p><strong>Portability:</strong> You may export your data at any time. We do not hold your data hostage or charge exit fees for your records.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-violet-500" /> 2. Payments & Fee Transparency
              </h2>
              <div className="space-y-3">
                <p><strong>Provider Fees:</strong> Pulse charges a monthly or per-feature subscription fee. This fee is separate from Stripe payment-processing fees.</p>
                <p><strong>Processing Fees:</strong> Transaction fees are determined by the payment processor. Pulse does not control these fees and they are deducted directly by the processor during the transaction.</p>
                <p><strong>Security:</strong> Pulse is PCI DSS compliant by design. We never store raw credit card numbers or CVVs on our servers. All sensitive payment data is tokenized by Stripe.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-violet-500" /> 3. Liability & Indemnification
              </h2>
              <div className="space-y-3">
                <p><strong>Limitation of Liability:</strong> To the maximum extent permitted by Alberta law, Pulse is not liable for indirect, incidental, or consequential damages, including lost profits or data loss resulting from your use of the service.</p>
                <p><strong>Indemnification:</strong> You agree to defend, indemnify, and hold harmless Pulse from any legal claims, damages, or costs (including lawyer fees) arising from your misuse of the platform, violation of privacy laws, or disputes with your clients.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-violet-500" /> 4. Governing Law & Arbitration
              </h2>
              <div className="space-y-3">
                <p><strong>Jurisdiction:</strong> These Terms are governed by the laws of the Province of Alberta and the federal laws of Canada applicable therein.</p>
                <p><strong>Dispute Resolution:</strong> Any disputes arising from these Terms shall be resolved through individual binding arbitration in <strong>Calgary, Alberta</strong>, rather than in court. You waive any right to participate in class actions or class-wide arbitration.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4">5. Account Suspension</h2>
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
