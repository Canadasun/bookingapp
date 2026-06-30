import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: buildAlternates("/compare", "fr"),
  title: "Comparer Pulse Appointments | vs. la concurrence",
  description: "Comment Pulse se compare à Square Appointments, Calendly, Acuity, Jane App, Vagaro et GlossGenius pour les entreprises de services canadiennes.",
};

const pages = [
  { href: "/fr/compare/pulse-vs-square-appointments", label: "Pulse vs. Square Appointments", desc: "Pour les entreprises qui n’ont pas besoin de matériel de point de vente" },
  { href: "/fr/compare/pulse-vs-calendly", label: "Pulse vs. Calendly", desc: "Pour les entreprises de services qui ont besoin d’acomptes et de paiements" },
  { href: "/fr/compare/pulse-vs-acuity-scheduling", label: "Pulse vs. Acuity Scheduling", desc: "Solution d’abord canadienne avec prix en CAD" },
  { href: "/fr/compare/pulse-vs-jane-app", label: "Pulse vs. Jane App", desc: "Pour les professionnels des services non cliniques" },
  { href: "/fr/compare/pulse-vs-vagaro", label: "Pulse vs. Vagaro", desc: "Configuration plus simple, aucuns frais de marché" },
  { href: "/fr/compare/pulse-vs-glossgenius", label: "Pulse vs. GlossGenius", desc: "Prix en CAD sans conversion USD" },
];

export default function ComparePageFr() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/fr" className="inline-flex items-center gap-2 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Appointments</span>
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Comparer Pulse</h1>
        <p className="text-slate-500 mb-8">Voyez comment Pulse se compare aux autres plateformes de réservation pour les entreprises de services canadiennes.</p>
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
