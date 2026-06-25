"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Calendar, Users,
  LogOut, X, ChevronRight, ChevronDown,
  MessageSquare, Menu as MenuIcon, CalendarPlus, Bell, CheckSquare, Scissors,
  DollarSign, BarChart3, FileText, Search, Megaphone, Settings as SettingsIcon,
  ShieldCheck, LifeBuoy,
} from "lucide-react";
import { api, type Business } from "@/lib/api";
import { clearSession, useCurrentUser, type SessionUser } from "@/lib/auth";
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
  { href: "/dashboard/clients",      label: "Clients",      icon: Users },
  { href: "/dashboard/messages",     label: "Messages",     icon: MessageSquare },
  {
    href: "#", label: "Financials", icon: DollarSign,
    children: [
      { href: "/dashboard/transactions", label: "Transactions" },
      { href: "/dashboard/invoices",     label: "Invoices" },
      { href: "/dashboard/reports",      label: "Reports" },
    ],
  },
  {
    href: "#", label: "Operations", icon: Scissors,
    children: [
      { href: "/dashboard/staff",        label: "Staff" },
      { href: "/dashboard/services",     label: "Services" },
      { href: "/dashboard/resources",    label: "Resources" },
      { href: "/dashboard/hours",        label: "Hours" },
      { href: "/dashboard/tasks",        label: "Tasks" },
      { href: "/dashboard/followups",    label: "Follow-ups" },
      { href: "/dashboard/waitlist",     label: "Waitlist" },
    ],
  },
  {
    href: "#", label: "Marketing",  icon: Megaphone,
    children: [
      { href: "/dashboard/marketing",    label: "Campaigns" },
      { href: "/dashboard/offers",       label: "Offers" },
      { href: "/dashboard/promo-codes",  label: "Promo codes" },
      { href: "/dashboard/gift-cards",   label: "Gift cards" },
      { href: "/dashboard/packages",     label: "Packages" },
      { href: "/dashboard/memberships",  label: "Memberships" },
      { href: "/dashboard/reviews",      label: "Reviews" },
    ],
  },
];

const STAFF_NAV: NavItem[] = [
  { href: "/dashboard/appointments", label: "My Appointments", icon: Calendar },
  { href: "/dashboard/tasks",        label: "My Tasks",        icon: CheckSquare },
  { href: "/dashboard/messages",     label: "Messages",        icon: MessageSquare },
];

// Pages reachable via sidebar footer / topbar — kept out of OWNER_NAV but
// still included in the command palette so owners can jump there with ⌘K.
const FOOTER_PAGES = [
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/account",       label: "Account" },
  { href: "/dashboard/settings",      label: "Settings" },
  { href: "/support",                 label: "Help & Support" },
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
            active ? "bg-violet-100 text-violet-800 font-semibold" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
          )}>
          <Icon className={cn("w-4 h-4 shrink-0", active ? "text-violet-700" : "text-gray-400 group-hover:text-gray-600")} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="ml-7 mt-0.5 space-y-0.5">
            {item.children.map((c, index) => {
              if (c.group) {
                return <p key={`${c.group}-${index}`} className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 first:pt-1">{c.group}</p>;
              }
              if (!c.href || !c.label) return null;
              return (
                <Link key={c.href} href={c.href} onClick={onClose}
                  className={cn(
                    "block px-3 py-2 rounded-lg text-sm transition-colors",
                    pathname === c.href.split("?")[0]
                      ? "text-violet-800 font-semibold bg-violet-100"
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
        active ? "bg-violet-100 text-violet-800 font-semibold" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
      )}>
      <Icon className={cn("w-4 h-4 shrink-0", active ? "text-violet-700" : "text-gray-400 group-hover:text-gray-600")} />
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
  const navItems = nav.flatMap((item) => {
    const parent = item.children
      ? []
      : [{ href: item.href, label: item.label }];
    const children = (item.children ?? [])
      .filter((child): child is Required<Pick<NavChild, "href" | "label">> => !!child.href && !!child.label)
      .map((child) => ({ href: child.href, label: child.label }));
    return [...parent, ...children];
  });
  return [...navItems, ...FOOTER_PAGES];
}

function CommandPalette({ open, nav, onClose }: { open: boolean; nav: NavItem[]; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Focus trap: prevent Tab from leaving the dialog.
  useEffect(() => {
    if (!open) return;
    function trapFocus(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const el = dialogRef.current;
      if (!el) return;
      const focusable = [...el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
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
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a page"
        className="mx-auto mt-16 w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            autoFocus
            aria-label="Search pages"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            placeholder="Jump to a page..."
            className="h-10 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-gray-400 lg:text-sm"
          />
          <kbd className="hidden rounded-md border border-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 sm:inline">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-500">No matching pages</p>
          ) : items.map((item) => (
            <button key={item.href} onClick={() => go(item.href)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700">
              <span>{item.label}</span>
              <span className="text-xs text-gray-600">{item.href.replace("/dashboard", "") || "/"}</span>
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

  if (!user || user.role === "ADMIN" || user.emailVerified !== false || dismissed) return null;

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

function TwoFactorRecommendation({ user }: { user: SessionUser | null }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const until = Number(localStorage.getItem("pulse_2fa_reminder_until") ?? "0");
      setDismissed(until > Date.now());
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!user || user.role === "ADMIN" || user.twoFactorEnabled || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem("pulse_2fa_reminder_until", String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    } catch {}
    setDismissed(true);
  }

  return (
    <div className="flex flex-col gap-2 border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <span className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-blue-700" />
        Protect your business: two-factor sign-in is recommended for owners and staff.
      </span>
      <div className="flex items-center gap-3 self-end sm:self-auto">
        <Link href="/dashboard/settings?tab=security" className="font-semibold text-blue-800 underline underline-offset-2 hover:text-blue-950">
          Turn on two-factor
        </Link>
        <button type="button" onClick={dismiss} aria-label="Dismiss two-factor reminder for 30 days" className="text-blue-700 hover:text-blue-950">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen]  = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const [biz, setBiz] = useState<Business | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // useCurrentUser() is the authoritative auth check. It calls /api/auth/me on
  // first mount (result is module-level cached), redirects to /login on 401, and
  // provides the full user profile (businessId, permissions, etc.) that the
  // minimal booking_user hint cookie no longer carries.
  const { user, loading } = useCurrentUser();

  // Keep the avatar and business data fresh on every navigation.
  useEffect(() => {
    api.users.me().then((u) => setAvatar(u.avatarUrl ?? null)).catch(() => {});
  }, [pathname]);
  useEffect(() => {
    if (user) setAvatar(user.avatarUrl ?? null);
  }, [user]);
  useEffect(() => {
    if (!user?.businessId) return;
    api.business.get(user.businessId).then(setBiz).catch(() => {});
    if (user.role !== "OWNER" && user.role !== "ADMIN") return;
    api.verification.status(user.businessId).then((v) => setVerified(v.verificationStatus === "VERIFIED")).catch(() => {});
  }, [user]);
  useEffect(() => {
    api.notifications.unreadCount()
      .then((r) => setUnread(r.count))
      .catch(() => setUnread(0));
  }, [pathname]);

  const refreshUnreadMessages = useCallback(() => {
    if (!user?.businessId) return;
    api.messages.unreadCount(user.businessId)
      .then((result) => setUnreadMessages(result.unreadMessages))
      .catch(() => {});
  }, [user]);

  const { connected: wsConnected } = useEvents(
    user?.businessId,
    useCallback(() => refreshUnreadMessages(), [refreshUnreadMessages]),
    undefined,
    useCallback(() => {
      api.notifications.unreadCount()
        .then((r) => setUnread(r.count))
        .catch(() => {});
    }, []),
  );

  // Poll for unread messages only when the WebSocket is not connected.
  // When the socket is live, real-time events drive refreshes instead,
  // eliminating 30-second interval noise on healthy connections.
  useEffect(() => {
    refreshUnreadMessages();
    const interval = wsConnected ? null : window.setInterval(refreshUnreadMessages, 30_000);
    const onVisibility = () => { if (document.visibilityState === "visible") refreshUnreadMessages(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (interval) window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname, refreshUnreadMessages, wsConnected]);

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
  const nav = user?.role === "STAFF" ? staffNav : user?.role === "OWNER" ? OWNER_NAV : [];

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    const onMq = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

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

  // Redirect to change-password if the API says the user must reset first.
  // The API also enforces this with 403 PASSWORD_RESET_REQUIRED, so this is
  // just an early client-side shortcut to avoid a full API round-trip first.
  useEffect(() => {
    if (user?.mustResetPassword) router.replace("/change-password");
  }, [user, router]);

  useEffect(() => {
    if (!loading && user && user.role !== "OWNER" && user.role !== "STAFF") {
      router.replace(user.role === "ADMIN" ? "/admin" : "/my/dashboard");
    }
  }, [loading, router, user]);

  const currentLabel =
    nav.flatMap((n) => [n, ...(n.children ?? []).filter((c) => c.href).map((c) => ({ ...c, icon: n.icon }))]).find((n) =>
      n.href === "/dashboard" ? pathname === n.href : n.href && pathname.startsWith(n.href.split("?")[0])
    )?.label ?? "Dashboard";

  // Show a blank shell while the auth check is in flight to prevent a flash of
  // the dashboard layout for unauthenticated visitors. useCurrentUser() redirects
  // to /login if the session is invalid.
  if (loading || !user || (user.role !== "OWNER" && user.role !== "STAFF")) {
    return (
      <div className="dashboard-shell flex brand-shell items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="dashboard-shell flex brand-shell">
      <CommandPalette open={commandOpen} nav={nav} onClose={() => setCommandOpen(false)} />

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        aria-hidden={isMobile && !open}
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 max-w-[85vw] bg-white/88 backdrop-blur-xl border-r border-[#E9DDCB] flex flex-col transition-transform duration-200 shadow-xl shadow-amber-900/5 dashboard-safe-bottom",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Business Logo/Name — Clicking leads to settings.
            Tapping it on mobile previously dumped owners onto "/", which reads as a
            sign-out. Keep them in the dashboard. */}
        <Link href="/dashboard" className="h-16 flex items-center gap-2.5 px-5 border-b border-[#E9DDCB] hover:bg-gray-50 transition-colors" title="Home">
          {biz?.logoUrl ? (
            <Image src={biz.logoUrl} alt="Business logo" width={36} height={36} className="w-9 h-9 rounded-xl object-cover shadow-lg shrink-0" />
          ) : (
            <Image src="/logo-icon.png" alt="Pulse" width={36} height={36} className="w-9 h-9 object-contain rounded-xl shrink-0" />
          )}
          <span className="font-bold text-ink tracking-tight truncate">{biz?.name ?? "Pulse"}</span>
        </Link>

        {/* Nav */}
        <nav aria-label="Main navigation" className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} onClose={() => setOpen(false)} unreadMessages={unreadMessages} />
          ))}
        </nav>

        {/* User + logout */}
        <div className="p-3 border-t border-[#E9DDCB]">
          {user && (
            <Link href="/dashboard/account" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="relative w-8 h-8 rounded-full bg-violet-100 ring-2 ring-white overflow-hidden flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">
                {avatar
                  ? <Image src={avatar} alt={`${user.name} profile photo`} fill className="object-cover" />
                  : user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role.toLowerCase()}</p>
              </div>
            </Link>
          )}
          <Link href="/dashboard/settings" onClick={() => setOpen(false)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
            <SettingsIcon className="w-4 h-4" /> Settings
          </Link>
          <Link href="/support" onClick={() => setOpen(false)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
            <LifeBuoy className="w-4 h-4" /> Help & Support
          </Link>
          <button onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* ── Main ──────────────────────────────────────────────────── */}
      <div className="dashboard-shell flex-1 lg:ml-60 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="h-16 bg-white/82 backdrop-blur-xl border-b border-[#E9DDCB] flex items-center justify-between gap-3 px-3 sm:px-6 sticky top-0 z-20">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Hamburger — 3 lines */}
            <button
              className="lg:hidden min-h-11 min-w-11 p-2 rounded-xl hover:bg-gray-100 transition-colors"
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
            <Link href="/dashboard/checkout"
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shrink-0">
              <CalendarPlus className="h-4 w-4" />
              <span className="hidden sm:inline">New booking</span>
            </Link>
            <button type="button" onClick={() => setCommandOpen(true)}
              className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 lg:inline-flex">
              <Search className="h-4 w-4" />
              <span>Search</span>
              <kbd className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">⌘K</kbd>
            </button>
            <Link href="/dashboard/notifications"
              className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-amber-50 p-2 text-amber-700 transition-colors hover:bg-amber-100"
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
              className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-violet-50 p-2 text-violet-700 transition-colors hover:bg-violet-100"
              aria-label={unreadMessages > 0 ? `${unreadMessages} unread client messages` : "Messages"}>
              <MessageSquare className="w-4.5 h-4.5" />
              {unreadMessages > 0 && (
                <span className="absolute -right-1.5 -top-1.5 min-w-5 h-5 rounded-full bg-red-600 px-1 text-[10px] leading-5 text-white text-center font-bold ring-2 ring-white">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </Link>
            {user && (
              <Link href="/dashboard/account" className="flex min-h-11 items-center gap-2 rounded-full pr-2 transition-colors hover:bg-gray-100" title="Your account">
                <div className="relative w-7 h-7 rounded-full bg-violet-100 ring-2 ring-white overflow-hidden flex items-center justify-center text-violet-700 font-bold text-xs">
                  {avatar
                    ? <Image src={avatar} alt={`${user.name} profile photo`} fill className="object-cover" />
                    : user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-sm font-medium text-gray-700">{user.name}</span>
              </Link>
            )}
          </div>
        </header>

        <EmailVerificationBanner user={user} />
        <TwoFactorRecommendation user={user} />
        <main id="main-content" className="flex-1 min-w-0 overflow-x-hidden p-3 sm:p-5 xl:p-6">{children}</main>
      </div>
    </div>
  );
}
