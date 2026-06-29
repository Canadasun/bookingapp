import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog | Pulse Appointments",
  description: "What's new in Pulse Appointments. Recent feature releases, improvements, and fixes.",
  openGraph: { title: "Changelog | Pulse Appointments", description: "New features and updates for Pulse Appointments." },
};

const entries = [
  {
    date: "June 2026",
    tag: "New",
    tagColor: "bg-violet-100 text-violet-700",
    title: "Google & Apple Sign-In",
    body: "Clients and business owners can now sign in and create accounts with a single click using Google or Apple. Works on web and mobile. GDPR/CASL consent is captured automatically.",
  },
  {
    date: "June 2026",
    tag: "New",
    tagColor: "bg-violet-100 text-violet-700",
    title: "WebSocket real-time dashboard",
    body: "The appointment calendar and inbox now update in real time when staff take actions — no more manual refreshes. Built on a hardened WebSocket layer with per-business channel isolation.",
  },
  {
    date: "June 2026",
    tag: "Improvement",
    tagColor: "bg-blue-100 text-blue-700",
    title: "Booking approval mode",
    body: "Businesses can now switch between Manual approval (bookings land as Pending until you confirm) and Auto-confirm (clients get an instant confirmation). Set it in Settings → Booking Policies.",
  },
  {
    date: "June 2026",
    tag: "New",
    tagColor: "bg-violet-100 text-violet-700",
    title: "Revenue Protected dashboard metric",
    body: "The Reports page now shows a Revenue Protected card — the total of deposits collected, no-show fees, and late-cancellation fees. See exactly how much money Pulse has protected for your business.",
  },
  {
    date: "June 2026",
    tag: "New",
    tagColor: "bg-violet-100 text-violet-700",
    title: "Client self-cancel toggle",
    body: "Business owners can now disable client self-cancel from Settings → Booking Policies. When off, clients see a neutral message directing them to contact the business.",
  },
  {
    date: "June 2026",
    tag: "Improvement",
    tagColor: "bg-blue-100 text-blue-700",
    title: "Client blocklist",
    body: "Staff can now block a client from their profile page. Blocked clients cannot complete new bookings online. The reason is visible only to staff — clients see a neutral slot-unavailable message.",
  },
  {
    date: "May 2026",
    tag: "New",
    tagColor: "bg-violet-100 text-violet-700",
    title: "Memberships and recurring billing",
    body: "Sell monthly memberships with Stripe billing. Members get discounted rates or free services included per billing period. Full member portal with usage tracking.",
  },
  {
    date: "May 2026",
    tag: "New",
    tagColor: "bg-violet-100 text-violet-700",
    title: "Gift cards",
    body: "Sell digital gift cards directly from your booking page. Clients receive a code by email and can redeem it at checkout.",
  },
  {
    date: "May 2026",
    tag: "New",
    tagColor: "bg-violet-100 text-violet-700",
    title: "Packages (pre-paid credit bundles)",
    body: "Sell 5-visit, 10-visit, or custom credit bundles. Clients redeem credits when they book. Track usage per client.",
  },
  {
    date: "April 2026",
    tag: "Improvement",
    tagColor: "bg-blue-100 text-blue-700",
    title: "Multi-location support",
    body: "Unlimited plan businesses can now add multiple locations. Staff are assigned to locations, clients see location details at booking, and the calendar filters by location.",
  },
  {
    date: "April 2026",
    tag: "New",
    tagColor: "bg-violet-100 text-violet-700",
    title: "Google Calendar two-way sync",
    body: "Connect your Google Calendar and appointments sync automatically in both directions. Busy blocks from your personal calendar appear as unavailable in your booking page.",
  },
  {
    date: "March 2026",
    tag: "Security",
    tagColor: "bg-green-100 text-green-700",
    title: "Two-factor authentication",
    body: "2FA is now available via email or SMS for all accounts. Recovery codes provided at enrollment. Trusted device memory for 30 days.",
  },
  {
    date: "March 2026",
    tag: "New",
    tagColor: "bg-violet-100 text-violet-700",
    title: "No-show fee auto-charge",
    body: "Set a no-show fee and Pulse automatically charges the saved card when you mark a client as no-show. Works with card-on-file and deposit flows.",
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Appointments</span>
        </Link>

        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">What&apos;s New</h1>
          <p className="text-slate-500">Feature releases, improvements, and fixes — newest first.</p>
        </div>

        <div className="space-y-6">
          {entries.map((e, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${e.tagColor}`}>{e.tag}</span>
                <span className="text-xs text-slate-400">{e.date}</span>
              </div>
              <h2 className="text-base font-semibold text-slate-900 mb-1.5">{e.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{e.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500 mb-4">Have a feature request or found a bug?</p>
          <Link href="/support" className="inline-block bg-violet-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-violet-700 transition-colors">
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
