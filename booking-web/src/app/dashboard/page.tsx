"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, MessageSquare, TrendingUp, Users, ChevronRight, ArrowRight, CalendarDays, CheckCircle2, CreditCard, MailWarning, TimerReset, ShieldCheck, Sparkles, X } from "lucide-react";
import { api, Appointment, DashboardOverview } from "@/lib/api";
import { useEvents } from "@/lib/hooks";
import { StatusBadge } from "@/components/StatusBadge";
import { SkeletonMetric, SkeletonRow } from "@/components/Skeleton";
import { formatPrice } from "@/lib/utils";
import { useCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function MetricCard({ label, value, icon: Icon, accent }: {
  label: string; value: string | number; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-start gap-3 sm:gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-default">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
      </div>
      <div className="min-w-0">
        <p className="max-w-full truncate text-xl sm:text-2xl font-bold text-gray-900 leading-none tabular-nums">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function formatTimeInZone(value: string | Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatDateInZone(value: string | Date, timezone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, ...options }).format(new Date(value));
}

function hourInZone(value: Date, timezone: string) {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(value));
}

function TimelineSlot({ apt, timezone }: { apt: Appointment; timezone: string }) {
  const start = new Date(apt.startsAt);
  const end   = new Date(apt.endsAt);
  const past  = end < new Date();
  return (
    <div className={`flex items-start gap-3 py-3 border-b border-gray-50 last:border-0 ${past ? "opacity-50" : ""}`}>
      <div className="w-14 shrink-0 text-right pt-0.5">
        <span className="text-xs font-semibold text-gray-500">{formatTimeInZone(start, timezone)}</span>
      </div>
      <div className="flex flex-col items-center pt-1.5 gap-1">
        <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
        <div className="w-px flex-1 min-h-6 bg-gray-100" />
      </div>
      <div className="flex-1 pb-2 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800 truncate">{apt.client.name}</p>
          <StatusBadge status={apt.status} />
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {apt.service.name} · {apt.staff.user.name}
        </p>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [showDemoBanner, setShowDemoBanner] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const isStaff = user?.role === "STAFF";
  const bizId   = user?.businessId ?? "";

  useEffect(() => {
    if (!userLoading && user?.role === "OWNER" && bizId) {
      api.business.get(bizId).then(biz => {
        if (!biz?.demoSeeded) setShowDemoBanner(true);
      }).catch(() => {});
    }
  }, [user, userLoading, bizId]);

  async function loadDemoData() {
    setSeedingDemo(true);
    try {
      const res = await fetch("/api/auth/seed-demo", { method: "POST" });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; skipped?: boolean };
      if (!res.ok) throw new Error("Failed");
      if (data.skipped) {
        toast.info("Demo data is already loaded — check each section to explore.");
      } else {
        toast.success("Demo data added! Browse each dashboard section to see examples.");
        load();
      }
      setShowDemoBanner(false);
    } catch {
      toast.error("Could not load demo data. Please try again.");
    } finally {
      setSeedingDemo(false);
    }
  }

  function dismissDemoBanner() {
    fetch("/api/auth/dismiss-demo", { method: "POST" }).catch(() => {});
    setShowDemoBanner(false);
  }

  const load = useCallback(async () => {
    if (userLoading) return;
    if (!bizId) {
      setLoading(false);
      return;
    }
    setLoading(true); setError("");
    try {
      setOverview(await api.business.dashboardOverview(bizId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  // React Compiler needs `user` here because `bizId` is derived from it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, user, bizId]);

  useEvents(bizId || null, useCallback(() => {
    load();
  }, [load]));

  useEffect(() => { load(); }, [load]);

  if (userLoading || loading) return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"><SkeletonMetric /><SkeletonMetric /><SkeletonMetric /><SkeletonMetric /></div>
      <div className="grid md:grid-cols-5 gap-5">
        <div className="md:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-1">
          {Array.from({length:6}).map((_,i)=><SkeletonRow key={i}/>)}
        </div>
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          {Array.from({length:4}).map((_,i)=><SkeletonRow key={i}/>)}
        </div>
      </div>
    </div>
  );
  if (error) return (
    <div className="text-center py-20">
      <p className="text-red-500 mb-3">{error}</p>
      <button onClick={load} className="text-violet-600 hover:underline text-sm">Retry</button>
    </div>
  );

  if (!overview) return null;

  const now = new Date();
  const timezone = overview.timezone || "UTC";
  const hour = hourInZone(now, timezone);
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const today = overview.today;
  const upcoming = overview.upcoming;
  const metrics = overview.metrics;
  const actions = [
    { label: "Pending bookings", value: metrics.pendingBookings, href: "/dashboard/appointments", icon: CalendarDays, tone: "bg-amber-50 text-amber-700", card: "border-amber-200 bg-amber-50/60 hover:bg-amber-50" },
    { label: "Unread messages", value: metrics.unreadMessages, href: "/dashboard/messages", icon: MessageSquare, tone: "bg-violet-50 text-violet-700", card: "border-violet-200 bg-violet-50/60 hover:bg-violet-50" },
    { label: "Unread alerts", value: metrics.unreadNotifications, href: "/dashboard/notifications", icon: Bell, tone: "bg-blue-50 text-blue-700", card: "border-blue-200 bg-blue-50/60 hover:bg-blue-50" },
    ...(!isStaff ? [
      { label: "Failed payments", value: metrics.failedPayments, href: "/dashboard/transactions", icon: CreditCard, tone: "bg-red-50 text-red-700", card: "border-red-200 bg-red-50/60 hover:bg-red-50" },
      { label: "Waiting clients", value: metrics.waitlistCount, href: "/dashboard/waitlist", icon: TimerReset, tone: "bg-emerald-50 text-emerald-700", card: "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50" },
      { label: "Failed deliveries", value: metrics.failedDeliveries, href: "/dashboard/notifications", icon: MailWarning, tone: "bg-red-50 text-red-700", card: "border-red-200 bg-red-50/60 hover:bg-red-50" },
    ] : []),
  ].filter((a) => a.value > 0);

  return (
    <div className="max-w-5xl mx-auto min-w-0 space-y-5 sm:space-y-6">

      {!isStaff && <ErrorBoundary><OnboardingWizard /></ErrorBoundary>}

      {showDemoBanner && (
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-sky-50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Sparkles className="w-6 h-6 text-violet-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-900">Explore with demo data</p>
            <p className="text-xs text-violet-700 mt-0.5">Load sample records into every dashboard section so you can see how each feature works before adding real data.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadDemoData}
              disabled={seedingDemo}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
            >
              {seedingDemo ? "Loading…" : "Load demo data"}
            </button>
            <button type="button" onClick={dismissDemoBanner} aria-label="Dismiss demo banner" className="p-1.5 text-violet-400 hover:text-violet-700 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900">
            Good {greeting}{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatDateInZone(now, timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <Link href="/dashboard/appointments"
          className="text-sm text-violet-600 font-medium flex items-center gap-1 hover:underline">
          All appointments <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>


      {actions.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-gray-900">Action needed</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {actions.map(({ label, value, href, icon: Icon, tone, card }) => (
              <Link key={label} href={href}
                className={`rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm ${card}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs font-medium text-gray-500">{label}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Get verified — one-click request, lands the business in the admin queue */}
      {!isStaff && (overview.verificationStatus === "UNVERIFIED" || overview.verificationStatus === "REJECTED") && (
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-sky-50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <ShieldCheck className="w-6 h-6 text-violet-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-900">Get your business verified</p>
            <p className="text-xs text-violet-700 mt-0.5">Earn a verified badge by submitting your legal details and supporting documents.</p>
          </div>
          <Link href="/dashboard/settings"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors">
            Get verified
          </Link>
        </div>
      )}
      {!isStaff && overview.verificationStatus === "PENDING" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">Verification requested — under review. We&apos;ll let you know once it&apos;s approved.</p>
        </div>
      )}

      {/* Metrics */}
      {!isStaff && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard label="Revenue this week" value={formatPrice(metrics.weekRevenue)}
            icon={TrendingUp} accent="bg-emerald-50 text-emerald-600" />
          <MetricCard label="Appointments today" value={today.length}
            icon={CalendarDays} accent="bg-blue-50 text-blue-600" />
          <MetricCard label="Completed this week" value={metrics.completedThisWeek}
            icon={CheckCircle2} accent="bg-amber-50 text-amber-600" />
          <MetricCard label="New clients this month" value={metrics.newClientsThisMonth}
            icon={Users} accent="bg-violet-50 text-violet-600" />
        </div>
      )}

      {/* Live schedule + stats grid */}
      <div className="grid md:grid-cols-5 gap-5">

        {/* Today timeline */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Today&apos;s schedule</h3>
              <p className="text-xs text-gray-400 mt-0.5">{today.length} appointment{today.length !== 1 ? "s" : ""}</p>
            </div>
            <span className="text-xs font-semibold text-white bg-violet-600 rounded-full px-2.5 py-1">
              {formatDateInZone(now, timezone, { month: "short", day: "numeric" })}
            </span>
          </div>
          <div className="px-5 max-h-80 overflow-y-auto">
            {today.length === 0 ? (
              <p className="py-10 text-sm text-gray-400 text-center">Nothing scheduled today</p>
            ) : today.map((apt) => <TimelineSlot key={apt.id} apt={apt} timezone={timezone} />)}
          </div>
          <div className="px-5 py-3 border-t border-gray-50">
            <Link href="/dashboard/appointments"
              className="text-xs text-violet-600 font-medium flex items-center gap-1 hover:underline">
              View &amp; manage all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Upcoming + quick stats */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Coming up</h3>
            <p className="text-xs text-gray-400 mt-0.5">Next {upcoming.length} upcoming</p>
          </div>
          {!isStaff && (
            <div className="grid grid-cols-2 gap-2 p-3 border-b border-gray-100">
              {[
                { label: "Cancelled (wk)", val: metrics.cancelledThisWeek },
                { label: "No-shows (mo)",  val: metrics.noShowsThisMonth },
                { label: "Top service",    val: metrics.topService ?? "—" },
                { label: "Waitlist",       val: metrics.waitlistCount },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{s.label}</p>
                  <p className="mt-0.5 text-lg font-bold text-gray-900 truncate">{s.val}</p>
                </div>
              ))}
            </div>
          )}
          <div className={`divide-y divide-gray-50 overflow-y-auto ${isStaff ? "max-h-80" : "max-h-64"}`}>
            {upcoming.length === 0 ? (
              <p className="py-10 text-sm text-gray-400 text-center">No upcoming appointments</p>
            ) : upcoming.map((apt) => (
              <div key={apt.id} className="px-5 py-3">
                <p className="text-xs font-semibold text-violet-600">
                  {formatDateInZone(apt.startsAt, timezone, { weekday: "short", month: "short", day: "numeric" })} · {formatTimeInZone(apt.startsAt, timezone)}
                </p>
                <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">{apt.client.name}</p>
                <p className="text-xs text-gray-500 truncate">{apt.service.name} · {apt.staff.user.name}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
