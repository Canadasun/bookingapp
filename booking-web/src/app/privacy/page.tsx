import Link from "next/link";
import { Calendar, ShieldCheck, Lock, Eye, Share2, Scale } from "lucide-react";

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
            <p className="text-violet-100 text-sm">Last updated: June 6, 2026 · Calgary, Alberta</p>
          </div>

          <div className="p-8 md:p-12 space-y-10 text-sm text-slate-600 leading-relaxed">
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-6 flex gap-4 italic text-slate-500">
              <ShieldCheck className="w-6 h-6 text-slate-400 shrink-0" />
              <p>
                Pulse is built on a "Privacy First" foundation. We provide the tools for your business, but you control the data. This policy explains our commitment to protecting information for both businesses and their clients.
              </p>
            </div>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-violet-500" /> 1. Roles & Responsibility (HIA/PIPA)
              </h2>
              <div className="space-y-3">
                <p><strong>Business Owners (Controllers):</strong> You are the "Custodian" or "Controller" of your clients' personal and health information. You are responsible for obtaining necessary consents and complying with Alberta's <em>Health Information Act</em> (HIA) or <em>Personal Information Protection Act</em> (PIPA).</p>
                <p><strong>Pulse (Processor):</strong> We act as your "Information Manager" or "Processor." We only access your data to provide technical support or deliver the services you have authorized (e.g., sending a booking reminder).</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-violet-500" /> 2. Information We Collect
              </h2>
              <div className="space-y-3">
                <p><strong>Account Data:</strong> We collect your name, business name, email, and phone number to manage your subscription and authenticate your access.</p>
                <p><strong>Service Data:</strong> This includes appointments, service lists, intake form answers, and client contact details. We process this data solely to provide the booking platform features.</p>
                <p><strong>Usage Data:</strong> We collect anonymous technical data (IP addresses, browser types) to improve platform stability and security.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-violet-500" /> 3. Data Security & Residency
              </h2>
              <div className="space-y-3">
                <p><strong>Encryption:</strong> All data is encrypted at rest and in transit using industry-standard AES-256 encryption. Passwords are never stored in plain text.</p>
                <p><strong>Data Residency:</strong> For our Canadian subscribers, we prioritize storage in Canadian data centers to align with provincial privacy recommendations.</p>
                <p><strong>PCI Compliance:</strong> Payment information is tokenized and handled entirely by Square or Stripe. Pulse never sees or stores full credit card numbers.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-violet-500" /> 4. Data Sharing
              </h2>
              <div className="space-y-3">
                <p>We do not sell, rent, or trade your data. We only share information with sub-processors essential to the service, such as:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Square/Stripe:</strong> For secure payment processing.</li>
                  <li><strong>Twilio/Resend:</strong> For SMS and email notifications.</li>
                  <li><strong>Google Cloud:</strong> For secure infrastructure and hosting.</li>
                </ul>
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
