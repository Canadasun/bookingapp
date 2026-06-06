"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  CreditCard,
  ExternalLink,
  FileText,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { api, AdminOverview, VerificationStatus } from "@/lib/api";
import { getUser, clearSession } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";
import { VerifiedBadge } from "@/components/VerifiedBadge";

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

const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

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
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
        </div>
        <div className="rounded-lg bg-gray-100 p-2 text-gray-600">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const me = getUser();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [items, setItems] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [overviewData, queue] = await Promise.all([
        api.admin.overview(),
        api.adminVerifications.list(),
      ]);
      setOverview(overviewData);
      setItems(queue);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load admin dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const planTotal = useMemo(() => {
    if (!overview) return 0;
    return overview.planCounts.FREE + overview.planCounts.BASIC + overview.planCounts.PRO;
  }, [overview]);

  async function approve(b: Pending) {
    if (!window.confirm(`Verify "${b.name}"? They'll get a Verified badge across their booking page, dashboard and emails.`)) return;
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

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwords.next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast.error("New passwords do not match");
      return;
    }
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

  return (
    <div className="min-h-screen bg-slate-50">
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
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">Admin dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Monitor platform activity, review verification requests, and manage your admin account.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
            {overview ? `Updated ${formatDistanceToNow(new Date(overview.generatedAt), { addSuffix: true })}` : "Loading platform status"}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Building2}
            label="Businesses"
            value={loading && !overview ? "..." : String(overview?.metrics.totalBusinesses ?? 0)}
            detail={`${overview?.metrics.activeSubscriptions ?? 0} active paid subscriptions`}
          />
          <MetricCard
            icon={Users}
            label="Users"
            value={loading && !overview ? "..." : String(overview?.metrics.totalUsers ?? 0)}
            detail={`${overview?.metrics.totalClients ?? 0} client records on platform`}
          />
          <MetricCard
            icon={CalendarClock}
            label="Appointments"
            value={loading && !overview ? "..." : String(overview?.metrics.upcomingAppointments ?? 0)}
            detail={`${overview?.metrics.recentAppointments ?? 0} created in the last 7 days`}
          />
          <MetricCard
            icon={CreditCard}
            label="30-day revenue"
            value={loading && !overview ? "..." : formatPrice(overview?.metrics.netRevenueCents ?? 0)}
            detail={`${overview?.metrics.successfulPayments ?? 0} successful platform payments`}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-950">Verification queue</h2>
                  <p className="text-sm text-gray-500">
                    {loading ? "Loading..." : items.length === 0 ? "No businesses awaiting review" : `${items.length} pending review${items.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <BadgeCheck className="h-5 w-5 text-violet-600" />
              </div>

              {loading ? (
                <div className="space-y-3 p-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
                    <Check className="h-5 w-5 text-emerald-600" />
                  </div>
                  <p className="font-semibold text-gray-950">All caught up</p>
                  <p className="mt-1 text-sm text-gray-500">New verification requests will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {items.map((b) => {
                    const submitted = b.verificationSubmittedAt ? new Date(b.verificationSubmittedAt) : null;
                    return (
                      <div key={b.id} className="p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-sm font-bold text-violet-700">
                              {initials(b.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-semibold text-gray-950">{b.name}</p>
                                <VerifiedBadge />
                              </div>
                              <p className="mt-0.5 truncate text-xs text-gray-500">{b.email} · /{b.slug}</p>
                              <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                <p><span className="font-semibold text-gray-800">Legal name:</span> {b.verificationLegalName || "Missing"}</p>
                                <p><span className="font-semibold text-gray-800">Address:</span> {b.verificationAddress || "Missing"}</p>
                                <p><span className="font-semibold text-gray-800">Phone:</span> {b.verificationPhone || "Missing"}</p>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                {submitted && (
                                  <span title={format(submitted, "PPpp")}>
                                    Submitted {formatDistanceToNow(submitted, { addSuffix: true })}
                                  </span>
                                )}
                                {b.verificationDocUrl ? (
                                  <a href={b.verificationDocUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-violet-600 hover:underline">
                                    <FileText className="h-3.5 w-3.5" /> Business registration <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-gray-400">
                                    <FileText className="h-3.5 w-3.5" /> No document attached
                                  </span>
                                )}
                                {b.verificationGovernmentIdUrl && (
                                  <a href={b.verificationGovernmentIdUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-violet-600 hover:underline">
                                    <ShieldCheck className="h-3.5 w-3.5" /> Government ID <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2 sm:justify-end">
                            <button
                              disabled={busy === b.id}
                              onClick={() => reject(b)}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 sm:flex-none"
                            >
                              <X className="h-4 w-4" /> Reject
                            </button>
                            <button
                              disabled={busy === b.id}
                              onClick={() => approve(b)}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:flex-none"
                            >
                              <Check className="h-4 w-4" /> {busy === b.id ? "Saving..." : "Approve"}
                            </button>
                          </div>
                        </div>
                        {b.verificationDocUrl && (
                          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                            <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-3 py-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                                <FileText className="h-3.5 w-3.5" /> Submitted document
                              </span>
                              <a
                                href={b.verificationDocUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline"
                              >
                                Open full size <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                            <iframe
                              src={b.verificationDocUrl}
                              title={`${b.name} verification document`}
                              className="h-80 w-full bg-white"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-base font-semibold text-gray-950">Recent businesses</h2>
                <p className="text-sm text-gray-500">Newest accounts, plans, verification, and billing status.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3">Business</th>
                      <th className="px-5 py-3">Plan</th>
                      <th className="px-5 py-3">Verification</th>
                      <th className="px-5 py-3">Billing</th>
                      <th className="px-5 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(overview?.recentBusinesses ?? []).map((b) => (
                      <tr key={b.id} className="align-top">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-950">{b.name}</p>
                          <p className="text-xs text-gray-500">{b.email} · /{b.slug}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700">{b.plan}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClass[b.verificationStatus]}`}>{b.verificationStatus}</span>
                        </td>
                        <td className="px-5 py-3 text-gray-600">
                          {b.suspended ? "Suspended" : b.subscription?.status ?? "No billing"}
                          {b.subscription?.cancelAtPeriodEnd && <span className="ml-1 text-amber-600">canceling</span>}
                        </td>
                        <td className="px-5 py-3 text-gray-500">{format(new Date(b.createdAt), "MMM d, yyyy")}</td>
                      </tr>
                    ))}
                    {!loading && (overview?.recentBusinesses.length ?? 0) === 0 && (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No businesses yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-950">Plan mix</h2>
              <div className="mt-4 space-y-3">
                {(["PRO", "BASIC", "FREE"] as const).map((plan) => {
                  const count = overview?.planCounts[plan] ?? 0;
                  const pct = planTotal ? Math.round((count / planTotal) * 100) : 0;
                  return (
                    <div key={plan}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium text-gray-700">{plan}</span>
                        <span className="text-gray-500">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-violet-600" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-950">Verification status</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(["PENDING", "VERIFIED", "UNVERIFIED", "REJECTED"] as VerificationStatus[]).map((status) => (
                  <div key={status} className={`rounded-lg border px-3 py-2 ${statusClass[status]}`}>
                    <p className="text-lg font-semibold">{overview?.verificationCounts[status] ?? 0}</p>
                    <p className="text-[11px] font-medium">{status}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-600" />
                <h2 className="text-base font-semibold text-gray-950">Change password</h2>
              </div>
              <form onSubmit={changePassword} className="mt-4 space-y-3">
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Current password"
                  value={passwords.current}
                  onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  required
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="New password"
                  value={passwords.next}
                  onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  required
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  required
                />
                <button
                  type="submit"
                  disabled={passwordBusy}
                  className="w-full rounded-lg bg-gray-950 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {passwordBusy ? "Updating..." : "Update password"}
                </button>
              </form>
              <p className="mt-3 text-xs text-gray-500">You will be signed out after a successful password change.</p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
