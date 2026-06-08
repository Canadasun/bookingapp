"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Calendar, Users,
  LogOut, X, ChevronRight, ChevronDown,
  MessageSquare, Menu as MenuIcon, CalendarPlus, Bell, CheckSquare, Scissors,
  DollarSign, BarChart3, FileText, Search,
} from "lucide-react";
import { api, type Business } from "@/lib/api";
import { getUser, clearSession, type SessionUser } from "@/lib/auth";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { cn } from "@/lib/utils";
import { useEvents } from "@/lib/hooks";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  children?: NavChild[];
}

interface NavChild {
  href?: string;
  label?: string;
  group?: string;
}

const OWNER_NAV: NavItem[] = [
  { href: "/dashboard",              label: "Home",         icon: LayoutDashboard },
  { href: "/dashboard/appointments", label: "Appointments", icon: Calendar },
  { href: "/dashboard/checkout",     label: "New booking",  icon: CalendarPlus },
  { href: "/dashboard/clients",      label: "Clients",      icon: Users },
  { href: "/dashboard/services",     label: "Services",     icon: Scissors },
  { href: "/dashboard/messages",     label: "Messages",     icon: MessageSquare },
  {
    href: "/dashboard/more",         label: "More",         icon: MenuIcon,
    children: [
      { group: "Operations" },
      { href: "/dashboard/staff",        label: "Staff" },
      { href: "/dashboard/tasks",        label: "Tasks" },
      { href: "/dashboard/followups",    label: "Follow-ups" },
      { href: "/dashboard/waitlist",     label: "Waitlist" },
      { group: "Growth" },
      { href: "/dashboard/offers",       label: "Offers" },
      { href: "/dashboard/reviews",      label: "Reviews" },
      { href: "/dashboard/marketing",    label: "Marketing" },
      { href: "/dashboard/gift-cards",   label: "Gift cards" },
      { href: "/dashboard/packages",     label: "Packages" },
      { group: "Financials" },
      { href: "/dashboard/transactions", label: "Transactions" },
      { href: "/dashboard/invoices",     label: "Invoices" },
      { href: "/dashboard/reports",      label: "Reports" },
      { group: "Admin" },
      { href: "/dashboard/notifications",label: "Notifications" },
      { href: "/dashboard/account",      label: "Account" },
      { href: "/dashboard/settings",     label: "Settings" },
    ],
  },
];

const STAFF_NAV: NavItem[] = [
  { href: "/dashboard/appointments", label: "My Appointments", icon: Calendar },
  { href: "/dashboard/tasks",        label: "My Tasks",        icon: CheckSquare },
  { href: "/dashboard/messages",     label: "Messages",        icon: MessageSquare },
];

function NavLink({ item, onClose, unreadMessages = 0 }: { item: NavItem; onClose: () => void; unreadMessages?: number }) {
  const pathname = usePathname();
  const childActive = item.children?.some((c) => c.href && pathname.startsWith(c.href.split("?")[0])) ?? false;
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
            {item.children.map((c, index) => {
              if (c.group) {
                return <p key={`${c.group}-${index}`} className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 first:pt-1">{c.group}</p>;
              }
              if (!c.href || !c.label) return null;
              return (
                <Link key={c.href} href={c.href} onClick={onClose}
                  className={cn(
                    "block px-3 py-2 rounded-lg text-sm transition-colors",
                    pathname === c.href.split("?")[0]
                      ? "text-violet-700 font-medium bg-violet-50"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-50",
                  )}>
                  {c.label}
                </Link>
              );
            })}
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
      {item.href === "/dashboard/messages" && unreadMessages > 0 && (
        <span className="min-w-5 h-5 rounded-full bg-red-600 px-1 text-[10px] leading-5 text-white text-center font-bold">
          {unreadMessages > 99 ? "99+" : unreadMessages}
        </span>
      )}
      {active && <ChevronRight className="w-3 h-3 text-violet-400" />}
    </Link>
  );
}

function commandItems(nav: NavItem[]) {
  return nav.flatMap((item) => {
    const parent = item.children
      ? []
      : [{ href: item.href, label: item.label }];
    const children = (item.children ?? [])
      .filter((child): child is Required<Pick<NavChild, "href" | "label">> => !!child.href && !!child.label)
      .map((child) => ({ href: child.href, label: child.label }));
    return [...parent, ...children];
  });
}

function CommandPalette({ open, nav, onClose }: { open: boolean; nav: NavItem[]; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const items = commandItems(nav).filter((item) =>
    !q || item.label.toLowerCase().includes(q) || item.href.toLowerCase().includes(q)
  );

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/25 p-3 sm:p-8" onClick={onClose}>
      <div className="mx-auto mt-16 w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            placeholder="Jump to a page..."
            className="h-8 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="hidden rounded-md border border-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 sm:inline">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-400">No matching pages</p>
          ) : items.map((item) => (
            <button key={item.href} onClick={() => go(item.href)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700">
              <span>{item.label}</span>
              <span className="text-xs text-gray-300">{item.href.replace("/dashboard", "") || "/"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmailVerificationBanner({ user }: { user: SessionUser | null }) {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerified !== false || dismissed) return null;

  async function resend() {
    setSending(true);
    try {
      await fetch("/proxy/auth/resend-verification", { method: "POST" });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-800">
      <span>
        {sent
          ? "Verification email sent — check your inbox."
          : "Please verify your email address to unlock all features."}
      </span>
      <div className="flex items-center gap-3 shrink-0">
        {!sent && (
          <button onClick={resend} disabled={sending}
            className="font-medium underline underline-offset-2 hover:text-amber-900 disabled:opacity-50">
            {sending ? "Sending…" : "Resend email"}
          </button>
        )}
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="hover:text-amber-900">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen]  = useState(false);
  const [user, setUser]  = useState<SessionUser | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const [biz, setBiz] = useState<Business | null>(null);

  // Re-read the (display) session and refresh the avatar on every navigation, so
  // edits made on the account page show up in the header/sidebar without a reload.
  useEffect(() => { setUser(getUser()); }, [pathname]);
  useEffect(() => {
    api.users.me().then((u) => setAvatar(u.avatarUrl ?? null)).catch(() => {});
  }, [pathname]);
  useEffect(() => {
    const u = getUser();
    if (!u?.businessId) return;
    api.business.get(u.businessId).then(setBiz).catch(() => {});
    if (u.role !== "OWNER" && u.role !== "ADMIN") return;
    api.verification.status(u.businessId).then((v) => setVerified(v.verificationStatus === "VERIFIED")).catch(() => {});
  }, []);
  useEffect(() => {
    api.notifications.unreadCount()
      .then((r) => setUnread(r.count))
      .catch(() => setUnread(0));
  }, [pathname]);

  const refreshUnreadMessages = useCallback(() => {
    const current = getUser();
    if (!current?.businessId) return;
    api.messages.unreadCount(current.businessId)
      .then((result) => setUnreadMessages(result.unreadMessages))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnreadMessages();
    const interval = window.setInterval(refreshUnreadMessages, 15_000);
    const onVisibility = () => { if (document.visibilityState === "visible") refreshUnreadMessages(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname, refreshUnreadMessages]);

  useEvents(useCallback(() => refreshUnreadMessages(), [refreshUnreadMessages]));

  // Staff get the base nav plus anything their granted permissions unlock.
  const perms = user?.permissions ?? [];
  const staffNav: NavItem[] = [
    ...STAFF_NAV,
    ...(perms.includes("MANAGE_SERVICES") ? [{ href: "/dashboard/services", label: "Services", icon: Scissors }] : []),
    ...(perms.includes("MANAGE_STAFF") ? [{ href: "/dashboard/staff", label: "Staff", icon: Users }] : []),
    ...(perms.includes("VIEW_MONEY")
      ? [
          { href: "/dashboard/transactions", label: "Transactions", icon: DollarSign },
          { href: "/dashboard/invoices",     label: "Invoices",     icon: FileText },
          { href: "/dashboard/reports",      label: "Reports",      icon: BarChart3 },
        ]
      : []),
  ];
  const nav = user?.role === "STAFF" ? staffNav : OWNER_NAV;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearSession();
    router.replace("/login");
  }

  const currentLabel =
    nav.flatMap((n) => [n, ...(n.children ?? []).filter((c) => c.href).map((c) => ({ ...c, icon: n.icon }))]).find((n) =>
      n.href === "/dashboard" ? pathname === n.href : n.href && pathname.startsWith(n.href.split("?")[0])
    )?.label ?? "Dashboard";

  return (
    <div className="flex min-h-screen brand-shell">
      <CommandPalette open={commandOpen} nav={nav} onClose={() => setCommandOpen(false)} />

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-60 bg-white/88 backdrop-blur-xl border-r border-[#E9DDCB] flex flex-col transition-transform duration-200 shadow-xl shadow-amber-900/5",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}>
        {/* Business Logo/Name — Clicking leads to settings.
            Tapping it on mobile previously dumped owners onto "/", which reads as a
            sign-out. Keep them in the dashboard. */}
        <Link href="/dashboard/settings" className="h-16 flex items-center gap-2.5 px-5 border-b border-[#E9DDCB] hover:bg-gray-50 transition-colors" title="Business settings">
          {biz?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={biz.logoUrl} alt="" className="w-9 h-9 rounded-xl object-cover shadow-lg shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-violet-600 shadow-lg shadow-violet-200 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="font-bold text-ink tracking-tight truncate">{biz?.name ?? "Pulse"}</span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} onClose={() => setOpen(false)} unreadMessages={unreadMessages} />
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
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen min-w-0">

        {/* Top bar */}
        <header className="h-16 bg-white/82 backdrop-blur-xl border-b border-[#E9DDCB] flex items-center justify-between gap-3 px-3 sm:px-6 sticky top-0 z-20">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Hamburger — 3 lines */}
            <button
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu">
              {open
                ? <X className="w-5 h-5 text-gray-600" />
                : <MenuIcon className="w-5 h-5 text-gray-600" />}
            </button>
            <h1 className="truncate text-sm font-semibold text-ink">{currentLabel}</h1>
            {verified && <VerifiedBadge />}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setCommandOpen(true)}
              className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 lg:inline-flex">
              <Search className="h-4 w-4" />
              <span>Search</span>
              <kbd className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">⌘K</kbd>
            </button>
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
              className="relative p-2 rounded-xl bg-violet-50 hover:bg-violet-100 transition-colors text-violet-700"
              aria-label={unreadMessages > 0 ? `${unreadMessages} unread client messages` : "Messages"}>
              <MessageSquare className="w-4.5 h-4.5" />
              {unreadMessages > 0 && (
                <span className="absolute -right-1.5 -top-1.5 min-w-5 h-5 rounded-full bg-red-600 px-1 text-[10px] leading-5 text-white text-center font-bold ring-2 ring-white">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
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

        <EmailVerificationBanner user={user} />
        <main className="flex-1 min-w-0 p-3 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
