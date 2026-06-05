"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar, CalendarPlus, Users, MessageSquare, CalendarClock, Settings, CheckSquare,
  LayoutDashboard, LogOut, ArrowRight, ShieldCheck,
} from "lucide-react";
import { getUser, clearSession, type SessionUser } from "@/lib/auth";
import { LandingSolutions } from "./LandingClient";

const OWNER_ACTIONS = [
  { icon: Calendar,      label: "Appointments", desc: "Today & upcoming",     href: "/dashboard/appointments" },
  { icon: CalendarPlus,  label: "New booking",  desc: "Book for a client",    href: "/dashboard/checkout" },
  { icon: Users,         label: "Clients",      desc: "Profiles & history",   href: "/dashboard/clients" },
  { icon: MessageSquare, label: "Messages",     desc: "Chat & texts",         href: "/dashboard/messages" },
  { icon: CalendarClock, label: "Follow-ups",   desc: "Recurring routines",   href: "/dashboard/followups" },
  { icon: Settings,      label: "Settings",     desc: "Payments, calendar…",  href: "/dashboard/settings" },
];
const STAFF_ACTIONS = [
  { icon: Calendar,      label: "My appointments", desc: "Your schedule", href: "/dashboard/appointments" },
  { icon: CheckSquare,   label: "My tasks",        desc: "Assigned to you", href: "/dashboard/tasks" },
  { icon: MessageSquare, label: "Messages",        desc: "Client chats",  href: "/dashboard/messages" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function LoggedInHome() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);

  const isStaff = user?.role === "STAFF";
  const isAdmin = user?.role === "ADMIN";
  const dashHome = isAdmin ? "/admin/verifications" : "/dashboard";
  const actions = isStaff ? STAFF_ACTIONS : OWNER_ACTIONS;
  const first = user?.name?.split(" ")[0] ?? "there";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen brand-shell flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/82 backdrop-blur-xl border-b border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-violet-600 shadow-lg shadow-violet-200 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-ink">Pulse</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href={dashHome} className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Link>
            {user && (
              <span className="hidden md:flex items-center gap-2 text-sm text-slate-600">
                <span className="w-7 h-7 rounded-full bg-violet-100 ring-2 ring-white flex items-center justify-center text-violet-700 font-bold text-xs">
                  {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                {first}
              </span>
            )}
            <button onClick={logout} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors">
              <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
          {/* Welcome hero — light, no fake mockup */}
          <div className="rounded-3xl bg-white/80 border border-[#E9DDCB] shadow-sm p-7 sm:p-9">
            <p className="text-sm font-semibold text-violet-600">{greeting()} 👋</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight mt-1">Welcome back, {first}</h1>
            <p className="text-slate-600 mt-2 max-w-xl">Here&apos;s your hub. Jump straight into your day, or pick up where you left off.</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link href={dashHome} className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white text-sm font-semibold px-6 py-3.5 rounded-xl hover:bg-violet-700 shadow-lg shadow-violet-200 transition-colors">
                <LayoutDashboard className="w-4 h-4" /> Open dashboard
              </Link>
              {!isStaff && !isAdmin && (
                <Link href="/dashboard/checkout" className="inline-flex items-center justify-center gap-2 bg-white text-slate-800 text-sm font-semibold px-6 py-3.5 rounded-xl border border-[#E9DDCB] hover:bg-violet-50 transition-colors">
                  <CalendarPlus className="w-4 h-4" /> New booking
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin/verifications" className="inline-flex items-center justify-center gap-2 bg-white text-slate-800 text-sm font-semibold px-6 py-3.5 rounded-xl border border-[#E9DDCB] hover:bg-violet-50 transition-colors">
                  <ShieldCheck className="w-4 h-4" /> Review verifications
                </Link>
              )}
            </div>
          </div>

          {/* Quick actions */}
          {!isAdmin && (
            <>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mt-10 mb-3">Quick access</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {actions.map(({ icon: Icon, label, desc, href }) => (
                  <Link key={label} href={href}
                    className="group rounded-2xl bg-white/80 border border-[#E9DDCB] p-5 hover:shadow-lg hover:shadow-violet-100 hover:-translate-y-0.5 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-violet-700" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors" />
                    </div>
                    <p className="font-semibold text-ink mt-3">{label}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Grow-your-business solutions (owners only; self-gates) */}
        {!isStaff && !isAdmin && <LandingSolutions />}
      </main>

      <footer className="py-6 border-t border-[#E9DDCB] bg-white/70">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between gap-4">
          <span className="text-sm text-slate-500">© {new Date().getFullYear()} Pulse</span>
          <button onClick={logout} className="text-sm text-slate-500 hover:text-red-600 transition-colors">Log out</button>
        </div>
      </footer>
    </div>
  );
}
