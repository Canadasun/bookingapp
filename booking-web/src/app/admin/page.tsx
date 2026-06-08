"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Ban,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { api, AdminOverview, FlaggedDuplicate, VerificationStatus, SystemError } from "@/lib/api";
import { getUser, clearSession } from "@/lib/auth";
import { formatPrice, cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/VerifiedBadge";

type Tab = "overview" | "verifications" | "businesses" | "duplicates" | "errors" | "users";

type Pending = {
  id: string;
  name: string;
  email: string;
  slug: string;
  verificationDocUrl: string | null;
  verificationGovernmentIdUrl: string | null;
  verificationLegalName: string | null;
  verificationAddress: string | null;
  verificationPhone: string | null;
  verificationSubmittedAt: string | null;
};

const initials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const statusClass: Record<VerificationStatus, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  UNVERIFIED: "bg-gray-50 text-gray-600 border-gray-200",
};

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className={cn("mt-2 text-3xl font-bold text-gray-950", accent)}>{value}</p>
        </div>
        <div className={cn("rounded-xl p-2.5", accent ? "bg-violet-100 text-violet-600" : "bg-gray-100 text-gray-600")}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const me = getUser();
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [duplicates, setDuplicates] = useState<FlaggedDuplicate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [sysErrors, setSysErrors] = useState<SystemError[]>([]);
  const [errFilter, setErrFilter] = useState<"unresolved" | "resolved" | "all">("unresolved");
  const [errBusy, setErrBusy] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [ov, q, dups] = await Promise.all([
        api.admin.overview(),
        api.adminVerifications.list(),
        api.adminVerifications.duplicates(),
      ]);
      setOverview(ov);
      setQueue(q);
      setDuplicates(dups);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadErrors = useCallback(async () => {
    try {
      const data = await api.systemErrors.list({
        resolved: errFilter === "resolved" ? true : errFilter === "unresolved" ? false : undefined,
        limit: 200,
      });
      setSysErrors(data);
    } catch { toast.error("Failed to load system errors"); }
  }, [errFilter]);

  useEffect(() => { if (tab === "errors") loadErrors(); }, [tab, loadErrors]);

  async function resolveError(id: string) {
    setErrBusy(true);
    try { await api.systemErrors.resolve(id); await loadErrors(); }
    catch { toast.error("Failed"); }
    finally { setErrBusy(false); }
  }

  async function resolveAllErrors() {
    if (!window.confirm("Mark all unresolved errors as resolved?")) return;
    setErrBusy(true);
    try { await api.systemErrors.resolveAll(); await loadErrors(); toast.success("All errors resolved"); }
    catch { toast.error("Failed"); }
    finally { setErrBusy(false); }
  }

  const planTotal = useMemo(() => {
    if (!overview) return 0;
    return overview.planCounts.FREE + overview.planCounts.BASIC + overview.planCounts.PRO;
  }, [overview]);

  async function approve(b: Pending) {
    if (!window.confirm(`Verify "${b.name}"? They'll receive a Verified badge.`)) return;
    setBusy(b.id);
    try {
      await api.adminVerifications.approve(b.id);
      toast.success(`${b.name} is now verified`);
      load(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function reject(b: Pending) {
    const note = window.prompt(`Reject "${b.name}"? Optional reason the owner will see:`);
    if (note === null) return;
    setBusy(b.id);
    try {
      await api.adminVerifications.reject(b.id, note || undefined);
      toast.success("Rejected");
      load(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSuspend(biz: AdminOverview["recentBusinesses"][0]) {
    const action = biz.suspended ? "unsuspend" : "suspend";
    if (!window.confirm(`${action === "suspend" ? "Suspend" : "Unsuspend"} "${biz.name}"? ${action === "suspend" ? "This hides their public booking page." : "This restores their booking page."}`)) return;
    setBusy(biz.id);
    try {
      if (biz.suspended) await api.admin.unsuspendBusiness(biz.id);
      else await api.admin.suspendBusiness(biz.id);
      toast.success(`${biz.name} ${action === "suspend" ? "suspended" : "reactivated"}`);
      load(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function dismissDuplicate(id: string, name: string) {
    if (!window.confirm(`Mark "${name}" as reviewed (not a duplicate)?`)) return;
    setBusy(id);
    try {
      await api.adminVerifications.dismissDuplicate(id);
      toast.success("Duplicate flag cleared");
      load(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwords.next.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (passwords.next !== passwords.confirm) { toast.error("Passwords do not match"); return; }
    setPasswordBusy(true);
    try {
      await api.auth.changePassword(passwords.current, passwords.next);
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      clearSession();
      toast.success("Password updated. Please sign in again.");
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearSession();
    router.replace("/login");
  }

  const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
    { id: "overview",      label: "Overview",      icon: LayoutDashboard },
    { id: "verifications", label: "Verifications", icon: BadgeCheck, badge: queue.length || undefined },
    { id: "businesses",    label: "Businesses",    icon: Building2 },
    { id: "duplicates",    label: "Duplicates",    icon: AlertTriangle, badge: duplicates.length || undefined },
    { id: "errors",        label: "Errors",        icon: Activity, badge: sysErrors.filter((e) => !e.resolved && e.severity === "CRITICAL").length || undefined },
    { id: "users",         label: "Users",         icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-gray-950">Pulse Admin</p>
              <p className="text-xs leading-tight text-gray-500">Operations dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {me && <span className="hidden max-w-[240px] truncate text-sm text-gray-500 sm:inline">{me.email}</span>}
            <button
              onClick={() => load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-violet-600 text-violet-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

        {/* ── OVERVIEW ───────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-950">Platform overview</h1>
                <p className="mt-1 text-sm text-gray-500">
                  {overview
                    ? `Updated ${formatDistanceToNow(new Date(overview.generatedAt), { addSuffix: true })}`
                    : "Loading platform status…"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={Building2} label="Businesses" accent="text-violet-600"
                value={loading && !overview ? "…" : String(overview?.metrics.totalBusinesses ?? 0)}
                detail={`${overview?.metrics.activeSubscriptions ?? 0} active paid subscriptions`}
              />
              <MetricCard icon={Users} label="Users"
                value={loading && !overview ? "…" : String(overview?.metrics.totalUsers ?? 0)}
                detail={`${overview?.metrics.totalClients ?? 0} client records on platform`}
              />
              <MetricCard icon={CalendarClock} label="Appointments"
                value={loading && !overview ? "…" : String(overview?.metrics.upcomingAppointments ?? 0)}
                detail={`${overview?.metrics.recentAppointments ?? 0} created in the last 7 days`}
              />
              <MetricCard icon={CreditCard} label="30-day revenue" accent="text-emerald-600"
                value={loading && !overview ? "…" : formatPrice(overview?.metrics.netRevenueCents ?? 0)}
                detail={`${overview?.metrics.successfulPayments ?? 0} successful payments`}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Plan mix */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-950">Plan mix</h2>
                <div className="mt-4 space-y-3">
                  {(["PRO", "BASIC", "FREE"] as const).map((plan) => {
                    const count = overview?.planCounts[plan] ?? 0;
                    const pct = planTotal ? Math.round((count / planTotal) * 100) : 0;
                    const colors: Record<string, string> = { PRO: "bg-violet-600", BASIC: "bg-blue-500", FREE: "bg-gray-300" };
                    return (
                      <div key={plan}>
                        <div className="mb-1.5 flex justify-between text-sm">
                          <span className="font-medium text-gray-700">{plan}</span>
                          <span className="text-gray-400">{count} · {pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100">
                          <div className={cn("h-2 rounded-full", colors[plan])} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Verification status */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-950">Verification status</h2>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {(["PENDING", "VERIFIED", "UNVERIFIED", "REJECTED"] as VerificationStatus[]).map((st) => (
                    <div key={st} className={cn("rounded-xl border px-3 py-3", statusClass[st])}>
                      <p className="text-2xl font-bold">{overview?.verificationCounts[st] ?? 0}</p>
                      <p className="text-[11px] font-semibold mt-0.5">{st}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-950">Quick actions</h2>
                <div className="mt-4 space-y-2">
                  {[
                    { label: "Review verification queue", count: queue.length, tab: "verifications" as Tab, icon: BadgeCheck, color: "text-violet-600" },
                    { label: "Flagged duplicate accounts", count: duplicates.length, tab: "duplicates" as Tab, icon: AlertTriangle, color: "text-amber-600" },
                  ].map((item) => (
                    <button
                      key={item.tab}
                      onClick={() => setTab(item.tab)}
                      className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left hover:border-violet-200 hover:bg-violet-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon className={cn("h-4 w-4", item.color)} />
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.count > 0 && (
                          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{item.count}</span>
                        )}
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">Change password</h3>
                  </div>
                  <form onSubmit={changePassword} className="space-y-2">
                    {[
                      { placeholder: "Current password", field: "current" as const, complete: "current-password" },
                      { placeholder: "New password", field: "next" as const, complete: "new-password" },
                      { placeholder: "Confirm new password", field: "confirm" as const, complete: "new-password" },
                    ].map(({ placeholder, field, complete }) => (
                      <input
                        key={field}
                        type="password"
                        autoComplete={complete}
                        placeholder={placeholder}
                        value={passwords[field]}
                        onChange={(e) => setPasswords((p) => ({ ...p, [field]: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                        required
                      />
                    ))}
                    <button
                      type="submit"
                      disabled={passwordBusy}
                      className="w-full rounded-lg bg-gray-950 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                    >
                      {passwordBusy ? "Updating…" : "Update password"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── VERIFICATIONS ──────────────────────────────────────────────── */}
        {tab === "verifications" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-950">Verification queue</h1>
              <p className="mt-1 text-sm text-gray-500">
                {loading ? "Loading…" : queue.length === 0 ? "No businesses awaiting review." : `${queue.length} pending review${queue.length === 1 ? "" : "s"}`}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              {loading ? (
                <div className="space-y-3 p-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
                  ))}
                </div>
              ) : queue.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="font-semibold text-gray-950">All caught up</p>
                  <p className="mt-1 text-sm text-gray-500">New verification requests will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {queue.map((b) => {
                    const submitted = b.verificationSubmittedAt ? new Date(b.verificationSubmittedAt) : null;
                    return (
                      <div key={b.id} className="p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700">
                              {initials(b.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-gray-950">{b.name}</p>
                                <VerifiedBadge />
                              </div>
                              <p className="mt-0.5 text-xs text-gray-500">{b.email} · /{b.slug}</p>
                              <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600 space-y-1">
                                <p><span className="font-semibold text-gray-800">Business name:</span> {b.verificationLegalName || "Missing"}</p>
                                <p><span className="font-semibold text-gray-800">Address:</span> {b.verificationAddress || "Missing"}</p>
                                <p><span className="font-semibold text-gray-800">Phone:</span> {b.verificationPhone || "Missing"}</p>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                {submitted && (
                                  <span title={format(submitted, "PPpp")}>Submitted {formatDistanceToNow(submitted, { addSuffix: true })}</span>
                                )}
                                {b.verificationDocUrl ? (
                                  <a href={b.verificationDocUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-violet-600 hover:underline">
                                    <FileText className="h-3.5 w-3.5" /> Business doc <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : <span className="text-gray-400"><FileText className="inline h-3.5 w-3.5 mr-1" />No document</span>}
                                {b.verificationGovernmentIdUrl && (
                                  <a href={b.verificationGovernmentIdUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-violet-600 hover:underline">
                                    <ShieldCheck className="h-3.5 w-3.5" /> Gov ID <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button disabled={busy === b.id} onClick={() => reject(b)}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 sm:flex-none">
                              <X className="h-4 w-4" /> Reject
                            </button>
                            <button disabled={busy === b.id} onClick={() => approve(b)}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:flex-none">
                              <Check className="h-4 w-4" /> {busy === b.id ? "Saving…" : "Approve"}
                            </button>
                          </div>
                        </div>
                        {b.verificationDocUrl && (
                          <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                            <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                                <FileText className="h-3.5 w-3.5" /> Submitted document
                              </span>
                              <a href={b.verificationDocUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline">
                                Open full size <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                            <iframe src={b.verificationDocUrl} title={`${b.name} verification`} className="h-80 w-full bg-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BUSINESSES ─────────────────────────────────────────────────── */}
        {tab === "businesses" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-950">Businesses</h1>
              <p className="mt-1 text-sm text-gray-500">All registered businesses, their plan, verification, and suspension status.</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3.5">Business</th>
                    <th className="px-5 py-3.5">Plan</th>
                    <th className="px-5 py-3.5">Verification</th>
                    <th className="px-5 py-3.5">Billing</th>
                    <th className="px-5 py-3.5">Created</th>
                    <th className="px-5 py-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(overview?.recentBusinesses ?? []).map((b) => (
                    <tr key={b.id} className={cn("align-middle", b.suspended && "bg-red-50/40")}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">
                            {initials(b.name)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-950">{b.name}</p>
                            <p className="text-xs text-gray-400">/{b.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-semibold",
                          b.plan === "PRO" ? "border-violet-200 bg-violet-50 text-violet-700"
                            : b.plan === "BASIC" ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-gray-200 bg-gray-50 text-gray-600"
                        )}>
                          {b.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", statusClass[b.verificationStatus])}>
                          {b.verificationStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 text-xs">
                        {b.suspended
                          ? <span className="font-semibold text-red-600">Suspended</span>
                          : b.subscription?.status ?? "No billing"}
                        {b.subscription?.cancelAtPeriodEnd && <span className="ml-1 text-amber-600">(canceling)</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{format(new Date(b.createdAt), "MMM d, yyyy")}</td>
                      <td className="px-5 py-3.5">
                        <button
                          disabled={busy === b.id}
                          onClick={() => toggleSuspend(b)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                            b.suspended
                              ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              : "border-red-200 text-red-600 hover:bg-red-50"
                          )}
                        >
                          {busy === b.id ? "…" : b.suspended ? <><CheckCircle2 className="h-3.5 w-3.5" />Unsuspend</> : <><Ban className="h-3.5 w-3.5" />Suspend</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && (overview?.recentBusinesses.length ?? 0) === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">No businesses yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DUPLICATES ─────────────────────────────────────────────────── */}
        {tab === "duplicates" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-950">Flagged duplicates</h1>
              <p className="mt-1 text-sm text-gray-500">
                Accounts flagged at signup as potential duplicates (same business name + phone number).
                {duplicates.length === 0 && !loading && " No flags right now."}
              </p>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : duplicates.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="font-semibold text-gray-950">No duplicate flags</p>
                <p className="mt-1 text-sm text-gray-500">Accounts are automatically flagged here when a new signup matches an existing business name and phone.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {duplicates.map((d) => (
                  <div key={d.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-xs font-bold text-amber-800">
                          {initials(d.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-950">{d.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{d.email} · {d.phone ?? "No phone"} · /{d.slug}</p>
                          {d.duplicateOf && (
                            <p className="mt-1.5 text-xs text-amber-800 font-medium">
                              Possible duplicate of: <span className="font-bold">{d.duplicateOf.name}</span> ({d.duplicateOf.email})
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          disabled={busy === d.id}
                          onClick={() => dismissDuplicate(d.id, d.name)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                          {busy === d.id ? "Clearing…" : "Not a duplicate"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SYSTEM ERRORS ──────────────────────────────────────────────── */}
        {tab === "errors" && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-gray-950">System Errors</h1>
                <p className="mt-1 text-sm text-gray-500">Server-side errors logged automatically. Resolve them once investigated.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1">
                  {(["unresolved", "resolved", "all"] as const).map((f) => (
                    <button key={f} onClick={() => setErrFilter(f)}
                      className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize", errFilter === f ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-500")}>
                      {f}
                    </button>
                  ))}
                </div>
                {errFilter === "unresolved" && sysErrors.length > 0 && (
                  <button onClick={resolveAllErrors} disabled={errBusy}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                    Resolve all
                  </button>
                )}
                <button onClick={loadErrors} disabled={errBusy} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                  <RefreshCw className={cn("w-4 h-4", errBusy && "animate-spin")} />
                </button>
              </div>
            </div>

            {sysErrors.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400 mb-3" />
                <p className="font-semibold text-gray-900">No {errFilter !== "all" ? errFilter : ""} errors</p>
                <p className="mt-1 text-sm text-gray-400">500 errors and webhook failures are logged here automatically.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sysErrors.map((e) => (
                  <div key={e.id} className={cn(
                    "rounded-xl border bg-white p-4 shadow-sm",
                    e.severity === "CRITICAL" ? "border-red-300" : e.severity === "ERROR" ? "border-orange-200" : "border-gray-200",
                  )}>
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide mt-0.5",
                        e.severity === "CRITICAL" ? "bg-red-100 text-red-700" : e.severity === "ERROR" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700",
                      )}>
                        {e.severity}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">{e.category}</span>
                          {e.businessId && <span className="text-xs text-gray-400 font-mono">{e.businessId.slice(0, 8)}…</span>}
                          <span className="text-xs text-gray-400">{format(new Date(e.createdAt), "MMM d, HH:mm")}</span>
                          {e.resolved && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">RESOLVED</span>}
                        </div>
                        <p className="mt-1 text-sm font-medium text-gray-900 break-words">{e.message}</p>
                        {e.context && Object.keys(e.context).length > 0 && (
                          <p className="mt-1 text-xs text-gray-400 font-mono break-words">
                            {Object.entries(e.context).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                          </p>
                        )}
                        {e.stack && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Stack trace</summary>
                            <pre className="mt-1 text-[11px] text-gray-500 bg-gray-50 rounded p-2 overflow-x-auto whitespace-pre-wrap">{e.stack.slice(0, 1000)}</pre>
                          </details>
                        )}
                      </div>
                      {!e.resolved && (
                        <button onClick={() => resolveError(e.id)} disabled={errBusy}
                          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors disabled:opacity-50">
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "users" && <UserSupportTab />}

      </main>
    </div>
  );
}

function UserSupportTab() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  type UserResult = { id: string; email: string; name: string; role: string; createdAt: string; emailVerified: boolean; business: { id: string; name: string; plan: string; suspended: boolean } | null; lockStatus: { locked: boolean; failCount: number; lockTtlSeconds: number } };
  const [result, setResult] = useState<UserResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function lookup() {
    if (!email.trim()) return;
    setBusy("lookup"); setResult(null); setNotFound(false);
    try {
      const u = await api.admin.lookupUser(email.trim().toLowerCase());
      setResult(u);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("not found") || msg.includes("404")) setNotFound(true);
      else toast.error(msg || "Lookup failed");
    } finally { setBusy(null); }
  }

  async function unlock() {
    if (!result) return;
    setBusy("unlock");
    try {
      const r = await api.admin.unlockUser(result.email);
      toast.success(r.message);
      setResult((prev) => prev ? { ...prev, lockStatus: { locked: false, failCount: 0, lockTtlSeconds: 0 } } : prev);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  async function sendReset() {
    if (!result) return;
    setBusy("reset");
    try {
      const r = await api.admin.sendPasswordReset(result.email);
      toast.success(r.message);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">User support</h2>
        <p className="text-sm text-gray-500 mt-0.5">Look up any account to check lock status, unlock it, or send a password reset on their behalf.</p>
      </div>

      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setNotFound(false); setResult(null); }}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="user@email.com"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <button
          onClick={lookup}
          disabled={busy === "lookup"}
          className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
        >
          {busy === "lookup" ? "…" : "Look up"}
        </button>
      </div>

      {notFound && (
        <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-xl p-4">No account found with that email address.</p>
      )}

      {result && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm divide-y divide-gray-50">
          <div className="p-5 space-y-1">
            <p className="font-semibold text-gray-900">{result.name}</p>
            <p className="text-sm text-gray-500">{result.email}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">{result.role}</span>
              {result.emailVerified
                ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">Email verified</span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Email not verified</span>
              }
              {result.business && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">{result.business.name} · {result.business.plan}</span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Login lock status</p>
            {result.lockStatus.locked ? (
              <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl p-3">
                <div>
                  <p className="text-sm font-medium text-red-800 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Account locked</p>
                  <p className="text-xs text-red-600 mt-0.5">Unlocks in {Math.ceil(result.lockStatus.lockTtlSeconds / 60)} min · {result.lockStatus.failCount} failed attempts</p>
                </div>
                <button onClick={unlock} disabled={busy === "unlock"} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                  {busy === "unlock" ? "…" : "Unlock now"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Not locked{result.lockStatus.failCount > 0 ? ` · ${result.lockStatus.failCount} recent failed attempts` : ""}
              </div>
            )}
          </div>

          <div className="p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Support actions</p>
            <button onClick={sendReset} disabled={busy === "reset"} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {busy === "reset" ? "Sending…" : "Send password reset email"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
