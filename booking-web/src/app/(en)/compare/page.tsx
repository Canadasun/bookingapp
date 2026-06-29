import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Compare Pulse Appointments | vs. Competitors",
  description: "How Pulse compares to Square Appointments, Calendly, Acuity, Jane App, Vagaro, and GlossGenius for Canadian service businesses.",
};

const pages = [
  { href: "/compare/pulse-vs-square-appointments", label: "Pulse vs. Square Appointments", desc: "For businesses that don't need POS hardware" },
  { href: "/compare/pulse-vs-calendly", label: "Pulse vs. Calendly", desc: "For service businesses that need deposits and payments" },
  { href: "/compare/pulse-vs-acuity-scheduling", label: "Pulse vs. Acuity Scheduling", desc: "Canada-first alternative with CAD pricing" },
  { href: "/compare/pulse-vs-jane-app", label: "Pulse vs. Jane App", desc: "For non-clinical service professionals" },
  { href: "/compare/pulse-vs-vagaro", label: "Pulse vs. Vagaro", desc: "Simpler setup, no marketplace fees" },
  { href: "/compare/pulse-vs-glossgenius", label: "Pulse vs. GlossGenius", desc: "CAD pricing without USD conversion" },
];

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Appointments</span>
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Compare Pulse</h1>
        <p className="text-slate-500 mb-8">See how Pulse stacks up against other booking platforms for Canadian service businesses.</p>
        <div className="space-y-3">
          {pages.map((p) => (
            <Link key={p.href} href={p.href} className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-5 hover:border-violet-300 hover:shadow-sm transition-all group">
              <div>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-violet-700">{p.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{p.desc}</p>
              </div>
              <span className="text-slate-400 group-hover:text-violet-600 text-lg">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
