"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, DollarSign, Activity,
  LogOut, Menu, X, ChevronRight, MessageSquare, Calendar,
  ShieldCheck, Settings2, Users2,
} from "lucide-react";
import { getUser, clearSession, type SessionUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const ADMIN_NAV: NavItem[] = [
  { href: "/admin",           label: "Overview",   icon: LayoutDashboard },
  { href: "/admin/salons",    label: "Salons",     icon: Building2 },
  { href: "/admin/finance",   label: "Finance",    icon: DollarSign },
  { href: "/admin/system",    label: "System",     icon: Activity },
  { href: "/admin/audits",    label: "Audits",     icon: ShieldCheck },
];

function NavLink({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const pathname = usePathname();
  const active = item.href === "/admin"
    ? pathname === item.href
    : pathname.startsWith(item.href);
  const Icon = item.icon;

  return (
    <Link href={item.href} onClick={onClose}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
        active ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
      )}>
      <Icon className={cn("w-4 h-4 shrink-0", active ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600")} />
      <span className="flex-1">{item.label}</span>
      {active && <ChevronRight className="w-3 h-3 text-indigo-400" />}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen]  = useState(false);
  const [user, setUser]  = useState<SessionUser | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "ADMIN") {
      router.replace("/login");
      return;
    }
    setUser(u);
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearSession();
    router.replace("/login");
  }

  if (!user) return null;

  const currentLabel =
    ADMIN_NAV.find((n) =>
      n.href === "/admin" ? pathname === n.href : pathname.startsWith(n.href)
    )?.label ?? "Admin";

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-gray-100 flex flex-col transition-transform duration-200 shadow-sm",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 tracking-tight">BookingApp</p>
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider -mt-1">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {ADMIN_NAV.map((item) => (
            <NavLink key={item.href} item={item} onClose={() => setOpen(false)} />
          ))}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
              {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p>
              <p className="text-xs text-indigo-600 font-bold">ADMIN</p>
            </div>
          </div>
          <button onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* ── Main ──────────────────────────────────────────────────── */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">

        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
              onClick={() => setOpen((o) => !o)}>
              {open ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
            </button>
            <h1 className="text-sm font-semibold text-gray-800">{currentLabel}</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-tight">System Live</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
              {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
