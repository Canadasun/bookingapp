import Link from "next/link";
import { Calendar } from "lucide-react";

export const metadata = { title: "Privacy Policy — BookingApp" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <Calendar className="w-7 h-7 text-violet-600" />
          <span className="text-xl font-bold text-slate-900">BookingApp</span>
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-8">Last updated: June 2026</p>

        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">1. What we collect</h2>
            <p>We collect the information you provide to run your account — your name, business details, email, and phone — and the booking, client, and message data you create in the Service.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">2. How we use it</h2>
            <p>We use your data to operate the Service: to authenticate you, manage appointments, send booking and reminder notifications by email and SMS, and process payments you initiate.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">3. Sharing</h2>
            <p>We share data only with the providers needed to deliver the Service — email, SMS, and payment processors — and only as needed to perform those functions. We do not sell your data.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">4. Your clients’ data</h2>
            <p>Client contact details you store belong to your business. You are the controller of that data; we process it on your behalf to provide the Service.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">5. Security &amp; retention</h2>
            <p>Passwords are stored hashed and traffic is encrypted in transit. We retain your data while your account is active and delete or anonymize it on request, subject to legal obligations.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2">6. Your choices</h2>
            <p>You can access, correct, or delete your data, and opt out of non-essential messages. Contact us at support@idowu.fyi to make a request.</p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 text-sm">
          <Link href="/terms" className="text-violet-600 hover:underline">Terms of Service</Link>
          <span className="text-slate-300 mx-2">·</span>
          <Link href="/" className="text-violet-600 hover:underline">Home</Link>
        </div>
      </div>
    </div>
  );
}
