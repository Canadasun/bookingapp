import Link from "next/link";
import { Calendar } from "lucide-react";

export const metadata = { title: "Terms of Service — Pulse" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <Calendar className="w-7 h-7 text-violet-600" />
          <span className="text-xl font-bold text-slate-900">Pulse</span>
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-400 mb-8">Last updated: June 2026</p>

        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">1. Acceptance</h2>
            <p>By creating an account or using Pulse (the “Service”) you agree to these Terms. If you are using the Service on behalf of a business, you represent that you are authorized to bind that business.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">2. Your account</h2>
            <p>You are responsible for the activity under your account and for keeping your credentials secure. You must provide accurate information and promptly update it when it changes.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">3. Acceptable use</h2>
            <p>You agree not to misuse the Service, including by attempting to access it in an unauthorized way, sending unsolicited messages, or using it to violate any law or the rights of others.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">4. Payments</h2>
            <p>Where you collect deposits, no-show fees, or other payments through the Service, those transactions are processed by our payment provider and are subject to their terms. You are responsible for your own tax and refund obligations.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">5. Termination</h2>
            <p>You may stop using the Service at any time. We may suspend or terminate access for violation of these Terms or to protect the Service and its users.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">6. Disclaimer</h2>
            <p>The Service is provided “as is” without warranties of any kind. To the extent permitted by law, we are not liable for indirect or consequential damages arising from your use of the Service.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">7. Contact</h2>
            <p>Questions about these Terms? Contact us at support@pulseappointments.com.</p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 text-sm">
          <Link href="/privacy" className="text-violet-600 hover:underline">Privacy Policy</Link>
          <span className="text-slate-300 mx-2">·</span>
          <Link href="/" className="text-violet-600 hover:underline">Home</Link>
        </div>
      </div>
    </div>
  );
}
