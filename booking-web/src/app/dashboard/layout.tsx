"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Calendar, Users,
  LogOut, X, ChevronRight, ChevronDown,
  MessageSquare, Menu as MenuIcon, CalendarPlus, Bell,
} from "lucide-react";
import { api } from "@/lib/api";
import { getUser, clearSession, type SessionUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  children?: { href: string; label: string }[];
}

const OWNER_NAV: NavItem[] = [
  { href: "/dashboard",              label: "Overview",     icon: LayoutDashboard },
  { href: "/dashboard/appointments", label: "Appointments", icon: Calendar },
  { href: "/dashboard/checkout",     label: "New booking",  icon: CalendarPlus },
  { href: "/dashboard/clients",      label: "Clients",      icon: Users },
  { href: "/dashboard/messages",     label: "Messages",     icon: MessageSquare },
  {
    href: "/dashboard/more",         label: "More",         icon: MenuIcon,
    children: [
      { href: "/dashboard/services",     label: "Services" },
      { href: "/dashboard/staff",        label: "Staff" },
      { href: "/dashboard/offers",       label: "Offers" },
      { href: "/dashboard/waitlist",     label: "Waitlist" },
      { href: "/dashboard/reviews",      label: "Reviews" },
      { href: "/dashboard/marketing",    label: "Marketing" },
      { href: "/dashboard/gift-cards",   label: "Gift cards" },
      { href: "/dashboard/packages",     label: "Packages" },
      { href: "/dashboard/transactions", label: "Transactions" },
      { href: "/dashboard/notifications",label: "Notifications" },
      { href: "/dashboard/account",      label: "Account" },
      { href: "/dashboard/settings",     label: "Settings" },
    ],
  },
];

const STAFF_NAV: NavItem[] = [
  { href: "/dashboard/appointments", label: "My Appointments", icon: Calendar },
  { href: "/dashboard/messages",     label: "Messages",        icon: MessageSquare },
];

function NavLink({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const pathname = usePathname();
  const childActive = item.children?.some((c) => pathname.startsWith(c.href.split("?")[0])) ?? false;
  const [open, setOpen] = useState(childActive);
  const active = item.href === "/dashboard"
    ? pathname === item.href
    : pathname.startsWith(item.href.split("?")[0]) || childActive;
  const Icon = item.icon;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
            active ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
          )}>
          <Icon className={cn("w-4 h-4 shrink-0", active ? "text-violet-600" : "text-gray-400 group-hover:text-gray-600")} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="ml-7 mt-0.5 space-y-0.5">
            {item.children.map((c) => (
              <Link key={c.href} href={c.href} onClick={onClose}
                className={cn(
                  "block px-3 py-2 rounded-lg text-sm transition-colors",
                  pathname === c.href.split("?")[0]
                    ? "text-violet-700 font-medium bg-violet-50"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-50",
                )}>
                {c.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link href={item.href} onClick={onClose}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
        active ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
      )}>
      <Icon className={cn("w-4 h-4 shrink-0", active ? "text-violet-600" : "text-gray-400 group-hover:text-gray-600")} />
      <span className="flex-1">{item.label}</span>
      {active && <ChevronRight className="w-3 h-3 text-violet-400" />}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen]  = useState(false);
  const [user, setUser]  = useState<SessionUser | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  // Re-read the (display) session and refresh the avatar on every navigation, so
  // edits made on the account page show up in the header/sidebar without a reload.
  useEffect(() => { setUser(getUser()); }, [pathname]);
  useEffect(() => {
    api.users.me().then((u) => setAvatar(u.avatarUrl ?? null)).catch(() => {});
  }, [pathname]);
  useEffect(() => {
    api.notifications.unreadCount()
      .then((r) => setUnread(r.count))
      .catch(() => setUnread(0));
  }, [pathname]);

  const nav = user?.role === "STAFF" ? STAFF_NAV : OWNER_NAV;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearSession();
    router.replace("/login");
  }

  const currentLabel =
    nav.flatMap((n) => [n, ...(n.children ?? []).map((c) => ({ ...c, icon: n.icon }))]).find((n) =>
      n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href.split("?")[0])
    )?.label ?? "Dashboard";

  return (
    <div className="flex min-h-screen brand-shell">

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-60 bg-white/88 backdrop-blur-xl border-r border-[#E9DDCB] flex flex-col transition-transform duration-200 shadow-xl shadow-amber-900/5",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-[#E9DDCB]">
          <div className="w-9 h-9 rounded-xl bg-violet-600 shadow-lg shadow-violet-200 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-ink tracking-tight">Pulse</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} onClose={() => setOpen(false)} />
          ))}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-[#E9DDCB]">
          {user && (
            <Link href="/dashboard/account" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-violet-100 ring-2 ring-white overflow-hidden flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">
                {avatar
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                  : user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user.role.toLowerCase()}</p>
              </div>
            </Link>
          )}
          <button onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
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
        <header className="h-16 bg-white/82 backdrop-blur-xl border-b border-[#E9DDCB] flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Hamburger — 3 lines */}
            <button
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu">
              {open
                ? <X className="w-5 h-5 text-gray-600" />
                : <MenuIcon className="w-5 h-5 text-gray-600" />}
            </button>
            <h1 className="text-sm font-semibold text-ink">{currentLabel}</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/notifications"
              className="relative p-2 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors text-amber-700"
              aria-label="Notifications">
              <Bell className="w-4.5 h-4.5" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 h-5 rounded-full bg-red-500 px-1 text-[10px] leading-5 text-white text-center font-bold">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            {/* Messages quick-link */}
            <Link href="/dashboard/messages"
              className="p-2 rounded-xl bg-violet-50 hover:bg-violet-100 transition-colors text-violet-700">
              <MessageSquare className="w-4.5 h-4.5" />
            </Link>
            {user && (
              <Link href="/dashboard/account" className="flex items-center gap-2 rounded-full hover:bg-gray-100 pr-2 transition-colors" title="Your account">
                <div className="w-7 h-7 rounded-full bg-violet-100 ring-2 ring-white overflow-hidden flex items-center justify-center text-violet-700 font-bold text-xs">
                  {avatar
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                    : user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-sm font-medium text-gray-700">{user.name}</span>
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
