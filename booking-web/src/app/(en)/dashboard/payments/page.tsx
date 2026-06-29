"use client";

import Link from "next/link";
import { DollarSign, CreditCard, Receipt, FileText, SlidersHorizontal, ChevronRight, type LucideIcon } from "lucide-react";
import { useDashboardLocale } from "@/lib/dashboard-locale";

const CARDS: { href: string; label: string; desc: string; icon: LucideIcon }[] = [
  { href: "/dashboard/checkout",              label: "Checkout",        desc: "Take an in-person payment or charge a saved card.",            icon: CreditCard },
  { href: "/dashboard/transactions",          label: "Transactions",    desc: "Every payment, refund, and payout in one ledger.",             icon: Receipt },
  { href: "/dashboard/invoices",              label: "Invoices",        desc: "Create, send, and track client invoices.",                     icon: FileText },
  { href: "/dashboard/settings?tab=payments", label: "Deposits & fees", desc: "Deposit rules, no-show and late-cancellation fees, tax.",      icon: SlidersHorizontal },
];

export default function PaymentsHub() {
  const copy = useDashboardLocale().dictionary.hubs.payments;
  const cards = CARDS.map((card, index) => {
    const translated = Object.values(copy.cards)[index];
    return { ...card, label: translated[0], desc: translated[1] };
  });
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-violet-600" />
          <h1 className="text-xl font-bold text-gray-900">{copy.title}</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">{copy.intro}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {cards.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href}
            className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:border-violet-200 hover:bg-violet-50/40 transition-colors">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <Icon className="w-5 h-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}
