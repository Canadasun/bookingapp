"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  Bot,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FileText,
  Funnel,
  HeartPulse,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  Minus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  api,
  AdminOverview,
  AdminBusiness,
  AdminAuditEntry,
  FlaggedDuplicate,
  PlanTier,
  VerificationStatus,
  SystemError,
} from "@/lib/api";
import { useCurrentUser, clearSession } from "@/lib/auth";
import { formatPrice, cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Tab =
  | "overview"
  | "verifications"
  | "businesses"
  | "duplicates"
  | "errors"
  | "health"
  | "funnel"
  | "users"
  | "audit"
  | "settings";

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
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const statusClass: Record<VerificationStatus, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  UNVERIFIED: "bg-gray-50 text-gray-600 border-gray-200",
};

const planClass: Record<PlanTier, string> = {
  UNLIMITED: "border-violet-300 bg-violet-50 text-violet-800",
  PRO: "border-violet-200 bg-violet-50 text-violet-700",
  BASIC: "border-blue-200 bg-blue-50 text-blue-700",
  FREE: "border-gray-200 bg-gray-50 text-gray-600",
};

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-gray-400">—</span>;
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-emerald-600" : "text-red-500")}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(pct)}%
      <span className="font-normal text-gray-400 ml-0.5">vs prev 30d</span>
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  trend,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  trend?: number | null;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-default">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className={cn("mt-2 text-3xl font-bold text-gray-950", accent)}>{value}</p>
          {trend !== undefined && (
            <div className="mt-1">
              <Trend pct={trend ?? null} />
            </div>
          )}
        </div>
        <div className={cn("rounded-xl p-2.5 shrink-0", accent ? "bg-violet-100 text-violet-700" : "bg-purple-50 text-purple-600")}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user: me, loading: authLoading } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [duplicates, setDuplicates] = useState<FlaggedDuplicate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [sysErrors, setSysErrors] = useState<SystemError[]>([]);
  const [errFilter, setErrFilter] = useState<"unresolved" | "resolved" | "all">("unresolved");
  const [errBusy, setErrBusy] = useState(false);
  const [errPatterns, setErrPatterns] = useState<{ category: string; total: number; critical: number; error: number; warn: number }[]>([]);
  const [bizHealth, setBizHealth] = useState<{ id?: string; name?: string; email?: string; plan?: string; errorCount: number }[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [funnel, setFunnel] = useState<{
    total: number;
    totals: { signedUp: number; addedService: number; addedStaff: number; stripeConnected: number; firstBooking: number; verified: number };
    businesses: { id: string; name: string; plan: string; createdAt: string; signedUp: boolean; addedService: boolean; addedStaff: boolean; stripeConnected: boolean; firstBooking: boolean; verified: boolean }[];
  } | null>(null);
  const [funnelBusy, setFunnelBusy] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);

  // Businesses tab state
  const [bizList, setBizList] = useState<{ businesses: AdminBusiness[]; total: number; page: number; pages: number } | null>(null);
  const [bizPage, setBizPage] = useState(1);
  const [bizSearch, setBizSearch] = useState("");
  const [bizPlanFilter, setBizPlanFilter] = useState("");
  const [bizStatusFilter, setBizStatusFilter] = useState("");
  const [bizSuspendedFilter, setBizSuspendedFilter] = useState("");
  const [bizSortBy, setBizSortBy] = useState("createdAt");
  const [bizSortDir, setBizSortDir] = useState<"asc" | "desc">("desc");
  const [bizLoading, setBizLoading] = useState(false);
  const [planBusy, setPlanBusy] = useState<string | null>(null);
  const [complimentaryBiz, setComplimentaryBiz] = useState<AdminBusiness | null>(null);
  const [complimentaryPlan, setComplimentaryPlan] = useState<"PRO" | "UNLIMITED">("PRO");
  const [complimentaryMonths, setComplimentaryMonths] = useState(3);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<{ logs: AdminAuditEntry[]; total: number; page: number; pages: number } | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditEntityType, setAuditEntityType] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);

  type DialogState = {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    inputPlaceholder?: string;
    variant?: "default" | "destructive";
    onConfirm: (val?: string) => void;
  };
  const [dialog, setDialog] = useState<DialogState>({ open: false, title: "", description: "", onConfirm: () => {} });
  const closeDialog = () => setDialog((d) => ({ ...d, open: false }));

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

  useEffect(() => {
    if (authLoading || !me) return;
    if (me.role !== "ADMIN") {
      router.replace("/dashboard");
      return;
    }
    load();
  }, [authLoading, load, me, router]);

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

  const loadHealth = useCallback(async () => {
    try {
      const [patterns, health] = await Promise.all([
        api.systemErrors.patterns(),
        api.systemErrors.businessHealth(),
      ]);
      setErrPatterns(patterns);
      setBizHealth(health);
    } catch { toast.error("Failed to load error health data"); }
  }, []);

  useEffect(() => { if (tab === "health") loadHealth(); }, [tab, loadHealth]);

  const loadFunnel = useCallback(async () => {
    setFunnelBusy(true);
    try { setFunnel(await api.admin.onboardingFunnel()); }
    catch { toast.error("Failed to load funnel"); }
    finally { setFunnelBusy(false); }
  }, []);

  useEffect(() => { if (tab === "funnel") loadFunnel(); }, [tab, loadFunnel]);

  const loadBusinesses = useCallback(async () => {
    setBizLoading(true);
    try {
      const result = await api.admin.listBusinesses({
        page: bizPage,
        limit: 50,
        search: bizSearch || undefined,
        plan: bizPlanFilter || undefined,
        verificationStatus: bizStatusFilter || undefined,
        suspended: bizSuspendedFilter === "true" ? true : bizSuspendedFilter === "false" ? false : undefined,
        sortBy: bizSortBy,
        sortDir: bizSortDir,
      });
      setBizList(result);
    } catch { toast.error("Failed to load businesses"); }
    finally { setBizLoading(false); }
  }, [bizPage, bizSearch, bizPlanFilter, bizStatusFilter, bizSuspendedFilter, bizSortBy, bizSortDir]);

  useEffect(() => { if (tab === "businesses") loadBusinesses(); }, [tab, loadBusinesses]);

  const loadAuditLog = useCallback(async () => {
    setAuditLoading(true);
    try {
      const result = await api.admin.auditLog({
        page: auditPage,
        limit: 50,
        entityType: auditEntityType || undefined,
        action: auditAction || undefined,
      });
      setAuditLogs(result);
    } catch { toast.error("Failed to load audit log"); }
    finally { setAuditLoading(false); }
  }, [auditPage, auditEntityType, auditAction]);

  useEffect(() => { if (tab === "audit") loadAuditLog(); }, [tab, loadAuditLog]);

  async function runAiExplain(category?: string) {
    setAiLoading(true);
    try {
      const res = await api.systemErrors.aiExplain(category);
      setAiExplanation(res.explanation ?? res.reason ?? "No response");
    } catch { toast.error("AI explain failed"); }
    finally { setAiLoading(false); }
  }

  async function resolveError(id: string) {
    setErrBusy(true);
    try { await api.systemErrors.resolve(id); await loadErrors(); }
    catch { toast.error("Failed"); }
    finally { setErrBusy(false); }
  }

  function resolveAllErrors() {
    setDialog({
      open: true, title: "Resolve all errors",
      description: "Mark every unresolved error as resolved? This cannot be undone in bulk.",
      confirmLabel: "Resolve all",
      onConfirm: async () => {
        closeDialog(); setErrBusy(true);
        try { await api.systemErrors.resolveAll(); await loadErrors(); toast.success("All errors resolved"); }
        catch { toast.error("Failed"); }
        finally { setErrBusy(false); }
      },
    });
  }

  const planTotal = useMemo(() => {
    if (!overview) return 0;
    return overview.planCounts.FREE + overview.planCounts.BASIC + overview.planCounts.PRO + overview.planCounts.UNLIMITED;
  }, [overview]);

  function approve(b: Pending) {
    setDialog({
      open: true, title: `Verify "${b.name}"?`,
      description: "They'll receive a Verified badge visible on their public booking page.",
      confirmLabel: "Approve verification",
      onConfirm: async () => {
        closeDialog(); setBusy(b.id);
        try { await api.adminVerifications.approve(b.id); toast.success(`${b.name} is now verified`); load(false); }
        catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
        finally { setBusy(null); }
      },
    });
  }

  function reject(b: Pending) {
    setDialog({
      open: true, title: `Reject "${b.name}"?`,
      description: "The business owner will be notified. You can optionally include a reason.",
      confirmLabel: "Reject", variant: "destructive",
      inputPlaceholder: "Optional reason the owner will see…",
      onConfirm: async (note) => {
        closeDialog(); setBusy(b.id);
        try { await api.adminVerifications.reject(b.id, note || undefined); toast.success("Rejected"); load(false); }
        catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
        finally { setBusy(null); }
      },
    });
  }

  function toggleSuspend(biz: { id: string; name: string; suspended: boolean }) {
    const isSuspending = !biz.suspended;
    setDialog({
      open: true,
      title: isSuspending ? `Suspend "${biz.name}"?` : `Reactivate "${biz.name}"?`,
      description: isSuspending
        ? "Their public booking page will be hidden and new bookings will be blocked."
        : "Their booking page will be restored and new bookings will be allowed.",
      confirmLabel: isSuspending ? "Suspend business" : "Reactivate business",
      variant: isSuspending ? "destructive" : "default",
      onConfirm: async () => {
        closeDialog(); setBusy(biz.id);
        try {
          if (biz.suspended) await api.admin.unsuspendBusiness(biz.id);
          else await api.admin.suspendBusiness(biz.id);
          toast.success(`${biz.name} ${isSuspending ? "suspended" : "reactivated"}`);
          load(false); loadBusinesses();
        } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
        finally { setBusy(null); }
      },
    });
  }

  async function overridePlan(biz: AdminBusiness, newPlan: PlanTier) {
    setPlanBusy(biz.id);
    try {
      await api.admin.setPlan(biz.id, newPlan);
      toast.success(`${biz.name} moved to ${newPlan}`);
      loadBusinesses();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setPlanBusy(null); }
  }

  async function grantComplimentaryAccess() {
    if (!complimentaryBiz) return;
    setPlanBusy(complimentaryBiz.id);
    try {
      const result = await api.admin.grantComplimentaryPlan(
        complimentaryBiz.id,
        complimentaryPlan,
        complimentaryMonths,
      );
      toast.success(
        `${complimentaryPlan} access granted to ${complimentaryBiz.name} until ${format(new Date(result.complimentaryPlanExpiresAt), "MMM d, yyyy")}`,
      );
      setComplimentaryBiz(null);
      await loadBusinesses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not grant complimentary access");
    } finally {
      setPlanBusy(null);
    }
  }

  function dismissDuplicate(id: string, name: string) {
    setDialog({
      open: true, title: `Clear duplicate flag for "${name}"?`,
      description: "Mark this account as reviewed — it will no longer appear in the duplicates queue.",
      confirmLabel: "Clear flag",
      onConfirm: async () => {
        closeDialog(); setBusy(id);
        try { await api.adminVerifications.dismissDuplicate(id); toast.success("Duplicate flag cleared"); load(false); }
        catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
        finally { setBusy(null); }
      },
    });
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
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not change password"); }
    finally { setPasswordBusy(false); }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearSession();
    router.replace("/login");
  }

  function sortBiz(field: string) {
    if (bizSortBy === field) setBizSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setBizSortBy(field); setBizSortDir("desc"); }
    setBizPage(1);
  }

  const NAV_ITEMS: { id: Tab; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
    { id: "overview",      label: "Overview",       icon: LayoutDashboard },
    { id: "verifications", label: "Verifications",  icon: BadgeCheck,     badge: queue.length || undefined },
    { id: "businesses",    label: "Businesses",     icon: Building2 },
    { id: "duplicates",    label: "Duplicates",     icon: AlertTriangle,  badge: duplicates.length || undefined },
    { id: "errors",        label: "Errors",         icon: Activity,       badge: sysErrors.filter((e) => !e.resolved && e.severity === "CRITICAL").length || undefined },
    { id: "health",        label: "Health",         icon: HeartPulse },
    { id: "funnel",        label: "Funnel",         icon: Funnel },
    { id: "users",         label: "User Support",   icon: Users },
    { id: "audit",         label: "Audit Log",      icon: History },
    { id: "settings",      label: "Settings",       icon: Settings },
  ];

  if (authLoading || !me || me.role !== "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm font-medium text-gray-500">
          <RefreshCw className="h-4 w-4 animate-spin text-violet-600" />
          {authLoading ? "Checking admin access…" : "Redirecting…"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <ConfirmDialog
        open={dialog.open}
        title={dialog.title}
        description={dialog.description}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.cancelLabel}
        inputPlaceholder={dialog.inputPlaceholder}
        variant={dialog.variant}
        onConfirm={dialog.onConfirm}
        onCancel={closeDialog}
      />
      {complimentaryBiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={() => setComplimentaryBiz(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="complimentary-plan-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="complimentary-plan-title" className="font-bold text-gray-950">Grant complimentary access</h2>
                <p className="mt-1 text-sm text-gray-500">{complimentaryBiz.name}</p>
              </div>
              <button type="button" onClick={() => setComplimentaryBiz(null)} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            {complimentaryBiz.subscription && ["ACTIVE", "TRIALING", "PAST_DUE"].includes(complimentaryBiz.subscription.status) ? (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                This business has active billing. Manage its subscription through Stripe instead.
              </div>
            ) : (
              <div className="mb-5 space-y-4">
                <div>
                  <label htmlFor="complimentary-plan" className="mb-1.5 block text-sm font-semibold text-gray-700">Plan</label>
                  <select id="complimentary-plan" value={complimentaryPlan} onChange={(event) => setComplimentaryPlan(event.target.value as "PRO" | "UNLIMITED")}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
                    <option value="PRO">Pro</option>
                    <option value="UNLIMITED">Unlimited</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="complimentary-months" className="mb-1.5 block text-sm font-semibold text-gray-700">Duration</label>
                  <select id="complimentary-months" value={complimentaryMonths} onChange={(event) => setComplimentaryMonths(Number(event.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
                    {[1, 2, 3, 6, 12].map((months) => (
                      <option key={months} value={months}>{months} month{months === 1 ? "" : "s"}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500">No Stripe subscription or charge will be created. The previous plan is restored automatically when access expires.</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setComplimentaryBiz(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={grantComplimentaryAccess}
                disabled={planBusy === complimentaryBiz.id || !!(complimentaryBiz.subscription && ["ACTIVE", "TRIALING", "PAST_DUE"].includes(complimentaryBiz.subscription.status))}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                {planBusy === complimentaryBiz.id ? "Granting…" : "Grant access"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className={cn(
        "flex flex-col border-r border-gray-200 bg-white transition-all duration-200 shrink-0",
        sidebarOpen ? "w-56" : "w-14",
      )}>
        {/* Logo */}
        <div className={cn("flex h-16 items-center border-b border-gray-100 px-3 gap-3", !sidebarOpen && "justify-center")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-gray-950 truncate">Pulse Admin</p>
              <p className="text-[10px] leading-tight text-gray-400 truncate">Operations</p>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              title={!sidebarOpen ? item.label : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all",
                tab === item.id
                  ? "bg-violet-50 text-violet-700"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
                !sidebarOpen && "justify-center px-0",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
              {sidebarOpen && item.badge != null && item.badge > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {item.badge}
                </span>
              )}
              {!sidebarOpen && item.badge != null && item.badge > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-2">
          <button
            onClick={signOut}
            title={!sidebarOpen ? "Sign out" : undefined}
            className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors", !sidebarOpen && "justify-center")}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {sidebarOpen && "Sign out"}
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Toggle sidebar"
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <div>
              <h1 className="text-sm font-bold text-gray-950">{NAV_ITEMS.find((n) => n.id === tab)?.label}</h1>
              {me && <p className="text-xs text-gray-400">{me.email}</p>}
            </div>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
          </button>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">

          {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div>
                <p className="text-xs text-gray-400">
                  {overview
                    ? `Last updated ${formatDistanceToNow(new Date(overview.generatedAt), { addSuffix: true })}`
                    : "Loading…"}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={Building2} label="Businesses" accent="text-violet-600"
                  value={loading && !overview ? "…" : String(overview?.metrics.totalBusinesses ?? 0)}
                  detail={`${overview?.metrics.newBusinessesThisPeriod ?? 0} new in last 30 days`}
                  trend={overview?.trends.bizGrowthPct}
                />
                <MetricCard
                  icon={Users} label="Users"
                  value={loading && !overview ? "…" : String(overview?.metrics.totalUsers ?? 0)}
                  detail={`${overview?.metrics.newUsersThisPeriod ?? 0} new this period · ${overview?.metrics.totalClients ?? 0} clients`}
                  trend={overview?.trends.userGrowthPct}
                />
                <MetricCard
                  icon={CalendarClock} label="Upcoming appointments"
                  value={loading && !overview ? "…" : String(overview?.metrics.upcomingAppointments ?? 0)}
                  detail={`${overview?.metrics.recentAppointments ?? 0} created in the last 7 days`}
                />
                <MetricCard
                  icon={CreditCard} label="30-day revenue" accent="text-emerald-600"
                  value={loading && !overview ? "…" : formatPrice(overview?.metrics.netRevenueCents ?? 0)}
                  detail={`${overview?.metrics.successfulPayments ?? 0} payments · ${overview?.metrics.activeSubscriptions ?? 0} active subs`}
                  trend={overview?.trends.revenueTrendPct}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Plan mix — all 4 tiers */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-semibold text-gray-950">Plan mix</h2>
                  <div className="mt-4 space-y-3">
                    {(["UNLIMITED", "PRO", "BASIC", "FREE"] as PlanTier[]).map((plan) => {
                      const count = overview?.planCounts[plan] ?? 0;
                      const pct = planTotal ? Math.round((count / planTotal) * 100) : 0;
                      const colors: Record<PlanTier, string> = {
                        UNLIMITED: "bg-violet-700",
                        PRO: "bg-violet-500",
                        BASIC: "bg-blue-500",
                        FREE: "bg-gray-300",
                      };
                      return (
                        <div key={plan}>
                          <div className="mb-1.5 flex justify-between text-sm">
                            <span className="font-medium text-gray-700">{plan}</span>
                            <span className="text-gray-500">{count} · {pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100">
                            <div className={cn("h-2 rounded-full transition-all", colors[plan])} style={{ width: `${pct}%` }} />
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
                      { label: "Verification queue", count: queue.length, tab: "verifications" as Tab, icon: BadgeCheck, color: "text-violet-600" },
                      { label: "Flagged duplicate accounts", count: duplicates.length, tab: "duplicates" as Tab, icon: AlertTriangle, color: "text-amber-600" },
                      { label: "Unresolved critical errors", count: sysErrors.filter((e) => !e.resolved && e.severity === "CRITICAL").length, tab: "errors" as Tab, icon: Activity, color: "text-red-500" },
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
                </div>
              </div>
            </div>
          )}

          {/* ── VERIFICATIONS ────────────────────────────────────────────── */}
          {tab === "verifications" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                {loading ? "Loading…" : queue.length === 0 ? "No businesses awaiting review." : `${queue.length} pending review${queue.length === 1 ? "" : "s"}`}
              </p>
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                {loading ? (
                  <div className="space-y-3 p-5">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}</div>
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
                                <p className="font-semibold text-gray-950">{b.name}</p>
                                <p className="mt-0.5 text-xs text-gray-500">{b.email} · /{b.slug}</p>
                                <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600 space-y-1">
                                  <p><span className="font-semibold text-gray-800">Legal name:</span> {b.verificationLegalName || "Missing"}</p>
                                  <p><span className="font-semibold text-gray-800">Address:</span> {b.verificationAddress || "Missing"}</p>
                                  <p><span className="font-semibold text-gray-800">Phone:</span> {b.verificationPhone || "Missing"}</p>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                  {submitted && <span title={format(submitted, "PPpp")}>Submitted {formatDistanceToNow(submitted, { addSuffix: true })}</span>}
                                  {b.verificationDocUrl ? (
                                    <a href={b.verificationDocUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-violet-600 hover:underline">
                                      <FileText className="h-3.5 w-3.5" /> Business doc <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : <span><FileText className="inline h-3.5 w-3.5 mr-1" />No document</span>}
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
                            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                              <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                                  <FileText className="h-3.5 w-3.5" /> Submitted document
                                </span>
                                <a href={b.verificationDocUrl} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline">
                                  Open full size <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                              <iframe src={b.verificationDocUrl} title={`${b.name} verification`} sandbox="allow-same-origin allow-scripts" className="h-80 w-full bg-white" />
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

          {/* ── BUSINESSES ───────────────────────────────────────────────── */}
          {tab === "businesses" && (
            <div className="space-y-4">
              {/* Search + filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search name, email, slug…"
                    value={bizSearch}
                    onChange={(e) => { setBizSearch(e.target.value); setBizPage(1); }}
                    className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>
                <select value={bizPlanFilter} onChange={(e) => { setBizPlanFilter(e.target.value); setBizPage(1); }}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-200">
                  <option value="">All plans</option>
                  {(["FREE", "BASIC", "PRO", "UNLIMITED"] as PlanTier[]).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={bizStatusFilter} onChange={(e) => { setBizStatusFilter(e.target.value); setBizPage(1); }}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-200">
                  <option value="">All statuses</option>
                  {(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] as VerificationStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={bizSuspendedFilter} onChange={(e) => { setBizSuspendedFilter(e.target.value); setBizPage(1); }}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-200">
                  <option value="">Active + Suspended</option>
                  <option value="false">Active only</option>
                  <option value="true">Suspended only</option>
                </select>
                <button onClick={loadBusinesses} disabled={bizLoading} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
                  <RefreshCw className={cn("h-4 w-4", bizLoading && "animate-spin")} />
                </button>
              </div>

              {bizList && (
                <p className="text-xs text-gray-500">{bizList.total} business{bizList.total !== 1 ? "es" : ""} · page {bizList.page} of {bizList.pages}</p>
              )}

              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      {[
                        { label: "Business", field: "name" },
                        { label: "Plan", field: "plan" },
                        { label: "Verification", field: "verificationStatus" },
                        { label: "Activity", field: null },
                        { label: "Billing", field: null },
                        { label: "Joined", field: "createdAt" },
                        { label: "Actions", field: null },
                      ].map(({ label, field }) => (
                        <th key={label}
                          onClick={field ? () => sortBiz(field) : undefined}
                          className={cn("px-4 py-3.5", field && "cursor-pointer hover:text-gray-700 select-none")}>
                          <span className="inline-flex items-center gap-1">
                            {label}
                            {field && bizSortBy === field && (
                              <span className="text-violet-500">{bizSortDir === "asc" ? "↑" : "↓"}</span>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bizLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-5 animate-pulse rounded bg-gray-100" /></td></tr>
                      ))
                    ) : (bizList?.businesses ?? []).map((b) => (
                      <tr key={b.id} className={cn("align-middle hover:bg-gray-50/60", b.suspended && "bg-red-50/30")}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">
                              {initials(b.name)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-950">{b.name}</p>
                              <p className="text-xs text-gray-400">{b.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <select
                            value={b.plan}
                            disabled={planBusy === b.id}
                            onChange={(e) => overridePlan(b, e.target.value as PlanTier)}
                            className={cn(
                              "rounded-lg border px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-200 cursor-pointer disabled:opacity-60",
                              planClass[b.plan],
                            )}
                          >
                            {(["FREE", "BASIC", "PRO", "UNLIMITED"] as PlanTier[]).map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", statusClass[b.verificationStatus])}>
                            {b.verificationStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-500">
                          <div className="flex flex-col gap-0.5">
                            <span>{b._count.appointments} appts</span>
                            <span>{b._count.staff} staff · {b._count.clients} clients</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-500">
                          <div className="flex flex-col gap-0.5">
                            <span>
                              {b.suspended
                                ? <span className="font-semibold text-red-600">Suspended</span>
                                : b.subscription?.status ?? "No billing"}
                              {b.subscription?.cancelAtPeriodEnd && <span className="ml-1 text-amber-600">(canceling)</span>}
                            </span>
                            {b.complimentaryPlanExpiresAt && (
                              <span className="font-semibold text-violet-700">
                                Gifted until {format(new Date(b.complimentaryPlanExpiresAt), "MMM d, yyyy")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                          {format(new Date(b.createdAt), "MMM d, yyyy")}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setComplimentaryPlan(b.plan === "UNLIMITED" ? "UNLIMITED" : "PRO");
                              setComplimentaryMonths(3);
                              setComplimentaryBiz(b);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50"
                          >
                            <CalendarClock className="h-3.5 w-3.5" />Gift access
                          </button>
                          <button
                            disabled={busy === b.id}
                            onClick={() => toggleSuspend(b)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                              b.suspended
                                ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                : "border-red-200 text-red-600 hover:bg-red-50",
                            )}
                          >
                            {busy === b.id ? "…" : b.suspended
                              ? <><CheckCircle2 className="h-3.5 w-3.5" />Unsuspend</>
                              : <><Ban className="h-3.5 w-3.5" />Suspend</>}
                          </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!bizLoading && (bizList?.businesses.length ?? 0) === 0 && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No businesses match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {bizList && bizList.pages > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setBizPage((p) => Math.max(1, p - 1))}
                    disabled={bizPage === 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <span className="text-xs text-gray-500">Page {bizPage} of {bizList.pages}</span>
                  <button
                    onClick={() => setBizPage((p) => Math.min(bizList.pages, p + 1))}
                    disabled={bizPage >= bizList.pages}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── DUPLICATES ───────────────────────────────────────────────── */}
          {tab === "duplicates" && (
            <div className="space-y-4">
              <p className="mt-1 text-sm text-gray-500">
                Accounts flagged at signup as potential duplicates (same business name + phone).
                {duplicates.length === 0 && !loading && " No flags right now."}
              </p>
              {loading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}</div>
              ) : duplicates.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="font-semibold text-gray-950">No duplicate flags</p>
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
                        <button disabled={busy === d.id} onClick={() => dismissDuplicate(d.id, d.name)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 shrink-0">
                          <Check className="h-4 w-4 text-emerald-600" />
                          {busy === d.id ? "Clearing…" : "Not a duplicate"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SYSTEM ERRORS ────────────────────────────────────────────── */}
          {tab === "errors" && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <p className="text-sm text-gray-500">Server-side errors logged automatically. Resolve once investigated.</p>
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
                </div>
              ) : (
                <div className="space-y-2">
                  {sysErrors.map((e) => (
                    <div key={e.id} className={cn("rounded-xl border bg-white p-4 shadow-sm",
                      e.severity === "CRITICAL" ? "border-red-300" : e.severity === "ERROR" ? "border-orange-200" : "border-gray-200")}>
                      <div className="flex items-start gap-3">
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide mt-0.5",
                          e.severity === "CRITICAL" ? "bg-red-100 text-red-700" : e.severity === "ERROR" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700")}>
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

          {/* ── HEALTH ───────────────────────────────────────────────────── */}
          {tab === "health" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <p className="text-sm text-gray-500">Patterns in unresolved errors and which businesses need attention.</p>
                <button onClick={loadHealth} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-violet-600" />
                    <p className="text-sm font-semibold text-violet-900">AI Error Analysis</p>
                    <span className="text-xs text-violet-500 bg-violet-100 rounded px-1.5 py-0.5">requires OPENAI_API_KEY</span>
                  </div>
                  <button onClick={() => runAiExplain()} disabled={aiLoading}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5">
                    {aiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                    {aiLoading ? "Analysing…" : "Explain errors"}
                  </button>
                </div>
                {aiExplanation && (
                  <div className="mt-3 text-sm text-violet-800 whitespace-pre-wrap bg-white rounded-lg p-3 border border-violet-100">{aiExplanation}</div>
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Patterns by category</h2>
                {errPatterns.length === 0 ? <p className="text-sm text-gray-500">No unresolved errors.</p> : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {errPatterns.map((p) => (
                      <div key={p.category} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{p.category}</span>
                          <span className="text-lg font-bold text-gray-900">{p.total}</span>
                        </div>
                        <div className="flex gap-2 text-xs">
                          {p.critical > 0 && <span className="bg-red-100 text-red-700 rounded px-1.5 py-0.5 font-semibold">{p.critical} CRITICAL</span>}
                          {p.error > 0 && <span className="bg-orange-100 text-orange-700 rounded px-1.5 py-0.5 font-semibold">{p.error} ERROR</span>}
                          {p.warn > 0 && <span className="bg-yellow-100 text-yellow-700 rounded px-1.5 py-0.5">{p.warn} WARN</span>}
                        </div>
                        <button onClick={() => runAiExplain(p.category)} disabled={aiLoading}
                          className="mt-2 text-xs text-violet-600 hover:underline flex items-center gap-1">
                          <Bot className="w-3 h-3" /> Explain
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Businesses with most errors</h2>
                {bizHealth.length === 0 ? <p className="text-sm text-gray-500">No business-specific errors.</p> : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Business</th>
                          <th className="px-4 py-3 font-semibold">Plan</th>
                          <th className="px-4 py-3 font-semibold text-right">Unresolved</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bizHealth.map((b, i) => (
                          <tr key={b.id ?? i} className="hover:bg-gray-50">
                            <td className="px-4 py-3"><p className="font-medium">{b.name ?? "Unknown"}</p><p className="text-xs text-gray-400">{b.email}</p></td>
                            <td className="px-4 py-3 text-xs font-semibold text-gray-500">{b.plan ?? "—"}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={cn("font-bold", b.errorCount >= 10 ? "text-red-600" : b.errorCount >= 3 ? "text-orange-500" : "text-gray-700")}>
                                {b.errorCount}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── FUNNEL ───────────────────────────────────────────────────── */}
          {tab === "funnel" && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <p className="text-sm text-gray-500">How many businesses completed each onboarding step.</p>
                <button onClick={loadFunnel} disabled={funnelBusy} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                  <RefreshCw className={cn("w-4 h-4", funnelBusy && "animate-spin")} />
                </button>
              </div>
              {!funnel && !funnelBusy && <p className="text-sm text-gray-500">Click refresh to load funnel data.</p>}
              {funnel && (
                <>
                  <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {([
                      { key: "signedUp", label: "Signed up" },
                      { key: "addedService", label: "Added service" },
                      { key: "addedStaff", label: "Added staff" },
                      { key: "stripeConnected", label: "Stripe connected" },
                      { key: "firstBooking", label: "First booking" },
                      { key: "verified", label: "Verified" },
                    ] as { key: keyof typeof funnel.totals; label: string }[]).map((step) => {
                      const count = funnel.totals[step.key];
                      const pct = funnel.total > 0 ? Math.round((count / funnel.total) * 100) : 0;
                      return (
                        <div key={step.key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-center">
                          <p className="text-2xl font-bold text-gray-900">{count}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{step.label}</p>
                          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{pct}%</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Business</th>
                          <th className="px-4 py-3 font-semibold">Plan</th>
                          {["Service", "Staff", "Stripe", "Booking", "Verified"].map((h) => (
                            <th key={h} className="px-4 py-3 font-semibold text-center">{h}</th>
                          ))}
                          <th className="px-4 py-3 font-semibold text-right">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {funnel.businesses.map((b) => (
                          <tr key={b.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{b.name}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-gray-500">{b.plan}</td>
                            {[b.addedService, b.addedStaff, b.stripeConnected, b.firstBooking, b.verified].map((done, i) => (
                              <td key={i} className="px-4 py-3 text-center">
                                {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <Minus className="w-4 h-4 text-gray-300 mx-auto" />}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right text-xs text-gray-400">{format(new Date(b.createdAt), "MMM d, yyyy")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── USER SUPPORT ─────────────────────────────────────────────── */}
          {tab === "users" && <UserSupportTab />}

          {/* ── AUDIT LOG ────────────────────────────────────────────────── */}
          {tab === "audit" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Full history of admin actions on users and businesses.</p>

              <div className="flex flex-wrap items-center gap-2">
                <select value={auditEntityType} onChange={(e) => { setAuditEntityType(e.target.value); setAuditPage(1); }}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-200">
                  <option value="">All entity types</option>
                  <option value="BUSINESS">Business</option>
                  <option value="USER">User</option>
                  <option value="APPOINTMENT">Appointment</option>
                </select>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="text" placeholder="Filter by action…" value={auditAction}
                    onChange={(e) => { setAuditAction(e.target.value); setAuditPage(1); }}
                    className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>
                <button onClick={loadAuditLog} disabled={auditLoading} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
                  <RefreshCw className={cn("h-4 w-4", auditLoading && "animate-spin")} />
                </button>
              </div>

              {auditLogs && (
                <p className="text-xs text-gray-500">{auditLogs.total} entries · page {auditLogs.page} of {auditLogs.pages}</p>
              )}

              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full min-w-[700px] text-sm text-left">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b">
                    <tr>
                      <th className="px-4 py-3.5">When</th>
                      <th className="px-4 py-3.5">Admin</th>
                      <th className="px-4 py-3.5">Action</th>
                      <th className="px-4 py-3.5">Entity</th>
                      <th className="px-4 py-3.5">Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-gray-100" /></td></tr>
                      ))
                    ) : (auditLogs?.logs ?? []).map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          <span title={format(new Date(log.createdAt), "PPpp")}>
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {log.user ? (
                            <div>
                              <p className="font-medium text-gray-800">{log.user.name}</p>
                              <p className="text-gray-400">{log.user.email}</p>
                            </div>
                          ) : <span className="text-gray-400">System</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            log.action.includes("SUSPEND") ? "bg-red-100 text-red-700"
                              : log.action.includes("APPROVE") || log.action.includes("REACTIVATE") ? "bg-emerald-100 text-emerald-700"
                              : log.action.includes("REJECT") || log.action.includes("DELETE") ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-600",
                          )}>
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          <span className="bg-gray-100 rounded px-1.5 py-0.5 text-gray-600 font-mono text-[10px]">{log.entityType}</span>
                          <span className="ml-1.5 text-gray-400 font-mono">{log.entityId.slice(0, 8)}…</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px]">
                          {log.changes ? (
                            <span className="font-mono">{JSON.stringify(log.changes).slice(0, 80)}</span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                    {!auditLoading && (auditLogs?.logs.length ?? 0) === 0 && (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">No audit entries match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {auditLogs && auditLogs.pages > 1 && (
                <div className="flex items-center justify-between">
                  <button onClick={() => setAuditPage((p) => Math.max(1, p - 1))} disabled={auditPage === 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <span className="text-xs text-gray-500">Page {auditPage} of {auditLogs.pages}</span>
                  <button onClick={() => setAuditPage((p) => Math.min(auditLogs.pages, p + 1))} disabled={auditPage >= auditLogs.pages}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ─────────────────────────────────────────────────── */}
          {tab === "settings" && (
            <div className="max-w-md space-y-6">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <Lock className="h-4 w-4 text-gray-500" />
                  <h2 className="text-base font-semibold text-gray-900">Change password</h2>
                </div>
                <form onSubmit={changePassword} className="space-y-3">
                  {[
                    { placeholder: "Current password", field: "current" as const, complete: "current-password" },
                    { placeholder: "New password (min 8 chars)", field: "next" as const, complete: "new-password" },
                    { placeholder: "Confirm new password", field: "confirm" as const, complete: "new-password" },
                  ].map(({ placeholder, field, complete }) => (
                    <input
                      key={field}
                      type="password"
                      autoComplete={complete}
                      placeholder={placeholder}
                      aria-label={placeholder}
                      value={passwords[field]}
                      onChange={(e) => setPasswords((p) => ({ ...p, [field]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      required
                    />
                  ))}
                  <button
                    type="submit"
                    disabled={passwordBusy}
                    className="w-full rounded-lg bg-gray-950 px-3 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                  >
                    {passwordBusy ? "Updating…" : "Update password"}
                  </button>
                </form>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900 mb-2">Session</h2>
                <p className="text-sm text-gray-500 mb-4">Signed in as <span className="font-medium text-gray-700">{me?.email}</span></p>
                <button onClick={signOut}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

function UserSupportTab() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  type UserResult = {
    id: string; email: string; name: string; role: string; createdAt: string;
    emailVerified: boolean;
    business: { id: string; name: string; plan: string; suspended: boolean } | null;
    lockStatus: { locked: boolean; failCount: number; lockTtlSeconds: number };
  };
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
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-gray-500">Look up any account to check lock status, unlock it, or send a password reset on their behalf.</p>

      <div className="flex gap-2">
        <label htmlFor="user-support-email" className="sr-only">User email address</label>
        <input
          id="user-support-email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setNotFound(false); setResult(null); }}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="user@email.com"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <button onClick={lookup} disabled={busy === "lookup"}
          className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
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
            <p className="text-xs text-gray-400">Joined {format(new Date(result.createdAt), "MMM d, yyyy")}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">{result.role}</span>
              {result.emailVerified
                ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">Email verified</span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Email not verified</span>}
              {result.business && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                  {result.business.name} · {result.business.plan}
                  {result.business.suspended && " · SUSPENDED"}
                </span>
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
                <button onClick={unlock} disabled={busy === "unlock"}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50">
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
            <button onClick={sendReset} disabled={busy === "reset"}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {busy === "reset" ? "Sending…" : "Send password reset email"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
