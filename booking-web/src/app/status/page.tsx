import Link from "next/link";
import { Calendar, Activity, ExternalLink, CheckCircle2, Clock } from "lucide-react";

export const metadata = {
  title: "System Status — Pulse",
  description: "Live uptime and incident information for Pulse Appointments.",
};

// Redirect to the external status dashboard after a short delay.
// Replace the href below with your BetterStack / Statuspage URL when provisioned.
const STATUS_PAGE_URL = "https://pulse-appointments.betteruptime.com";

export default function StatusPage() {
  return (
    <>
      {/* Meta refresh — browser redirects automatically after 4 s */}
      <meta httpEquiv="refresh" content={`4; url=${STATUS_PAGE_URL}`} />

      <div className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Link href="/" className="inline-flex items-center gap-2 mb-10">
            <Calendar className="w-8 h-8 text-violet-600" />
            <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse</span>
          </Link>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-8 py-10 text-white">
              <div className="flex items-center gap-3 mb-3">
                <Activity className="w-7 h-7 text-emerald-400" />
                <h1 className="text-3xl font-bold">System Status</h1>
              </div>
              <p className="text-slate-400 text-sm">
                Live uptime metrics, incident history, and maintenance notices for Pulse Appointments.
              </p>
            </div>

            <div className="p-8 md:p-12 space-y-8">
              {/* Auto-redirect notice */}
              <div className="rounded-2xl bg-violet-50 border border-violet-100 p-6 flex gap-4">
                <Clock className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-violet-900">Redirecting to status dashboard…</p>
                  <p className="text-xs text-violet-600">
                    You&apos;ll be taken to our live status page in a moment. If the redirect doesn&apos;t happen automatically,{" "}
                    <a
                      href={STATUS_PAGE_URL}
                      className="font-semibold underline hover:text-violet-800"
                      rel="noopener noreferrer"
                    >
                      click here
                    </a>
                    .
                  </p>
                </div>
              </div>

              {/* What's tracked */}
              <section>
                <h2 className="text-base font-bold text-slate-900 mb-4">What We Monitor</h2>
                <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-600">
                  {[
                    "API & Booking Engine",
                    "Web Dashboard",
                    "Client Booking Portal",
                    "Mobile App (iOS & Android)",
                    "Stripe Payments & Payouts",
                    "SMS & Email Notifications",
                    "Database & File Storage",
                    "Push Notification Delivery",
                  ].map((service) => (
                    <div key={service} className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{service}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* CTA */}
              <div className="text-center space-y-4 pt-2">
                <a
                  href={STATUS_PAGE_URL}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors"
                  rel="noopener noreferrer"
                >
                  Open Live Status Dashboard <ExternalLink className="w-4 h-4" />
                </a>
                <p className="text-xs text-slate-400">
                  Subscribe to incident notifications directly on the status page.
                </p>
              </div>

              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <p className="text-xs text-slate-400">support@pulseappointments.com</p>
                <div className="flex gap-6">
                  <Link href="/support" className="text-violet-600 font-semibold text-sm hover:underline">Support</Link>
                  <Link href="/" className="text-violet-600 font-semibold text-sm hover:underline">Home</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
