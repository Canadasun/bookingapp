"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutDashboard, CalendarCheck, CreditCard, Link2, Users, ArrowRight, Sparkles, CalendarPlus } from "lucide-react";
import { getUser, type SessionUser } from "@/lib/auth";

function homeFor(user: SessionUser | null): string | null {
  if (!user) return null;
  return user.role === "ADMIN" ? "/admin/verifications" : user.role === "CLIENT" ? "/my/dashboard" : "/dashboard";
}

// Hero CTA: logged-in users see a way into the app instead of sign-in / sign-up.
export function LandingHeroCta() {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);
  const home = homeFor(user);
  if (user && home) {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link href={home} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-violet-600 text-white text-base font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-xl shadow-violet-200">
          <LayoutDashboard className="w-5 h-5" /> Go to dashboard
        </Link>
        <Link href="/book" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/90 text-slate-800 text-base font-semibold px-8 py-4 rounded-xl border border-[#E9DDCB] hover:bg-violet-50 transition-colors">
          <CalendarPlus className="w-4 h-4" /> Book an appointment
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-violet-600 text-white text-base font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-xl shadow-violet-200">
        <Sparkles className="w-5 h-5" /> Get started free
      </Link>
      <Link href="/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/90 text-slate-800 text-base font-semibold px-8 py-4 rounded-xl border border-[#E9DDCB] hover:bg-violet-50 transition-colors">
        Sign in <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// Bottom band: prospects get the marketing CTA; logged-in users get a "jump back in".
export function LandingBottomCta() {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);
  const home = homeFor(user);
  if (user && home) {
    return (
      <>
        <h2 className="text-3xl font-bold text-white mb-4">Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h2>
        <p className="text-white/60 mb-8">Pick up right where you left off.</p>
        <div className="flex justify-center">
          <Link href={home} className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-8 py-4 rounded-xl hover:bg-violet-50 transition-colors">
            <LayoutDashboard className="w-5 h-5" /> Go to dashboard
          </Link>
        </div>
      </>
    );
  }
  return (
    <>
      <h2 className="text-3xl font-bold text-white mb-4">Ready to simplify your scheduling?</h2>
      <p className="text-white/60 mb-8">Join thousands of businesses using Pulse.</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link href="/register" className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-8 py-4 rounded-xl hover:bg-violet-50 transition-colors">
          <Sparkles className="w-5 h-5" /> Get started free
        </Link>
        <Link href="/login" className="inline-flex items-center gap-2 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-colors">
          Sign in <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </>
  );
}

// Footer links adapt to the session too.
export function LandingFooterLinks() {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);
  const home = homeFor(user);
  if (user && home) {
    return (
      <div className="flex gap-6 text-sm text-slate-500">
        <Link href={home} className="hover:text-indigo-600 transition-colors">Dashboard</Link>
        <Link href="/book" className="hover:text-indigo-600 transition-colors">Book</Link>
      </div>
    );
  }
  return (
    <div className="flex gap-6 text-sm text-slate-500">
      <Link href="/register" className="hover:text-indigo-600 transition-colors">Get started</Link>
      <Link href="/login" className="hover:text-indigo-600 transition-colors">Sign in</Link>
    </div>
  );
}

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
