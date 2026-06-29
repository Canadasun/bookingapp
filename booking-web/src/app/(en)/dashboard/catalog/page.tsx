"use client";

import Link from "next/link";
import { Scissors, Users, Boxes, Clock, ChevronRight, type LucideIcon } from "lucide-react";

const CARDS: { href: string; label: string; desc: string; icon: LucideIcon }[] = [
  { href: "/dashboard/services",  label: "Services",            desc: "The services clients can book, with prices and durations.", icon: Scissors },
  { href: "/dashboard/staff",     label: "Staff",               desc: "Your team, their roles, and the services each one offers.",   icon: Users },
  { href: "/dashboard/resources", label: "Spaces & Equipment",  desc: "Rooms, chairs, and equipment that bookings depend on.",       icon: Boxes },
  { href: "/dashboard/hours",     label: "Hours",               desc: "When you're open — the windows clients can book within.",     icon: Clock },
];

export default function CatalogHub() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Scissors className="w-5 h-5 text-violet-600" />
          <h1 className="text-xl font-bold text-gray-900">Catalog</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">What you offer and who delivers it — services, team, spaces, and hours.</p>
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
