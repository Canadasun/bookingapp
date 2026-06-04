"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutDashboard, CalendarCheck, CreditCard, Link2, Users, ArrowRight } from "lucide-react";
import { getUser, type SessionUser } from "@/lib/auth";

// Nav CTA that adapts to the session: a logged-in owner/staff/client sees a quick
// link into their dashboard instead of Sign in / Get started.
export function LandingAuthCta() {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);

  if (user) {
    const home = user.role === "CLIENT" ? "/my/dashboard" : "/dashboard";
    return (
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-sm text-slate-600">Hi, {user.name.split(" ")[0]}</span>
        <Link href={home}
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors">
          <LayoutDashboard className="w-4 h-4" /> Go to dashboard
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-violet-700 transition-colors">Sign in</Link>
      <Link href="/register" className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors">Get started</Link>
    </div>
  );
}

const RESOURCES = [
  { icon: CalendarCheck, title: "Connect Google Calendar", desc: "Sync confirmed bookings to your calendar automatically.", href: "/dashboard/settings" },
  { icon: CreditCard,    title: "Set up payments with Stripe", desc: "Collect deposits and keep a card on file for no-shows.", href: "/dashboard/settings" },
  { icon: Link2,         title: "Share your booking link", desc: "Put it in your Instagram bio, website or Google profile.", href: "/dashboard/settings" },
  { icon: Users,         title: "Add staff as you grow", desc: "Start solo — add team members only when you need to.", href: "/dashboard/staff" },
];

// Logged-in owners get a "get the most out of Pulse" strip on the landing page,
// linking straight into the relevant dashboard setup.
export function LandingResources() {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);
  if (!user || user.role === "CLIENT") return null;

  return (
    <section className="py-16 bg-white/60 border-y border-[#E9DDCB]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-ink">Welcome back, {user.name.split(" ")[0]} 👋</h2>
            <p className="text-slate-500 mt-1">A few things to get the most out of Pulse.</p>
          </div>
          <Link href="/dashboard" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline shrink-0">
            Open dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {RESOURCES.map(({ icon: Icon, title, desc, href }) => (
            <Link key={title} href={href}
              className="group rounded-2xl bg-white border border-[#E9DDCB] p-5 hover:shadow-lg hover:shadow-violet-100 transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-violet-700" />
              </div>
              <h3 className="font-semibold text-ink text-sm mb-1">{title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 opacity-0 group-hover:opacity-100 transition-opacity">
                Set up <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
