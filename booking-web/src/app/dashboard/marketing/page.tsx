"use client";

import Link from "next/link";
import { Megaphone, Send, Tag, Ticket, Gift, Package, BadgeCheck, ChevronRight, type LucideIcon } from "lucide-react";

const CARDS: { href: string; label: string; desc: string; icon: LucideIcon }[] = [
  { href: "/dashboard/marketing/campaigns", label: "Campaigns",   desc: "Email and SMS blasts to your client list.",                  icon: Send },
  { href: "/dashboard/offers",              label: "Offers",      desc: "Win-backs and seasonal promotions to fill your book.",       icon: Tag },
  { href: "/dashboard/promo-codes",         label: "Promo codes", desc: "Discount codes clients apply at checkout.",                  icon: Ticket },
  { href: "/dashboard/gift-cards",          label: "Gift cards",  desc: "Sell and redeem gift cards for your services.",              icon: Gift },
  { href: "/dashboard/packages",            label: "Packages",    desc: "Bundle multiple sessions at a set price.",                   icon: Package },
  { href: "/dashboard/memberships",         label: "Memberships", desc: "Recurring plans that keep clients coming back.",             icon: BadgeCheck },
];

export default function MarketingHub() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-violet-600" />
          <h1 className="text-xl font-bold text-gray-900">Marketing</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">Grow revenue and retention — campaigns, offers, gift cards, packages, and memberships.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {CARDS.map(({ href, label, desc, icon: Icon }) => (
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
