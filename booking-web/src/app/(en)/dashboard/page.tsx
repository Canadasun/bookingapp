"use client";

import { useEffect, useState, useCallback } from "react";
import { useLocationScope } from "@/lib/location-scope";
import Link from "next/link";
import { AlertTriangle, Bell, MessageSquare, TrendingUp, Users, ChevronRight, ArrowRight, CalendarDays, CheckCircle2, CreditCard, MailWarning, TimerReset, ShieldCheck, Sparkles, X, Globe } from "lucide-react";
import { api, Appointment, DashboardOverview } from "@/lib/api";
import { useEvents } from "@/lib/hooks";
import { StatusBadge } from "@/components/StatusBadge";
import { SkeletonMetric, SkeletonRow } from "@/components/Skeleton";
import { useCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDashboardLocale, type DashboardLocale } from "@/lib/dashboard-locale";

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

function formatTimeInZone(value: string | Date, timezone: string, locale: DashboardLocale) {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatDateInZone(value: string | Date, timezone: string, options: Intl.DateTimeFormatOptions, locale: DashboardLocale) {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", { timeZone: timezone, ...options }).format(new Date(value));
}

function hourInZone(value: Date, timezone: string) {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(value));
}

function TimelineSlot({ apt, timezone, locale }: { apt: Appointment; timezone: string; locale: DashboardLocale }) {
  const start = new Date(apt.startsAt);
  const end   = new Date(apt.endsAt);
  const past  = end < new Date();
  return (
    <div className={`flex items-start gap-3 py-3 border-b border-gray-50 last:border-0 ${past ? "opacity-50" : ""}`}>
      <div className="w-14 shrink-0 text-right pt-0.5">
        <span className="text-xs font-semibold text-gray-500">{formatTimeInZone(start, timezone, locale)}</span>
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
  const { locale, dictionary, formatCurrency } = useDashboardLocale();
  const copy = dictionary.overview;
  const { user, loading: userLoading } = useCurrentUser();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [showDemoBanner, setShowDemoBanner] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  // Best-effort setup status for the dashboard chips (never blocks the page).
  const [calSync, setCalSync] = useState<{ connected: boolean; configured: boolean } | null>(null);
  const [payoutsReady, setPayoutsReady] = useState<boolean | null>(null);
  const isStaff = user?.role === "STAFF";
  const bizId   = user?.businessId ?? "";

  useEffect(() => {
    if (!userLoading && user?.role === "OWNER" && bizId) {
      api.business.get(bizId).then(biz => {
        if (!biz?.demoSeeded) setShowDemoBanner(true);
        setPayoutsReady(!!biz?.stripeConnectOnboarded);
      }).catch(() => {});
      api.calendarSync.status()
        .then(s => setCalSync({ connected: s.connected, configured: s.configured }))
        .catch(() => {});
    }
  }, [user, userLoading, bizId]);

  async function loadDemoData() {
    setSeedingDemo(true);
    try {
      const res = await fetch("/api/auth/seed-demo", { method: "POST" });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; skipped?: boolean };
      if (!res.ok) throw new Error("Failed");
      if (data.skipped) {
        toast.info(copy.demoAlreadyLoaded);
      } else {
        toast.success(copy.demoAdded);
        load();
      }
      setShowDemoBanner(false);
    } catch {
      toast.error(copy.demoFailed);
    } finally {
      setSeedingDemo(false);
    }
  }

  function dismissDemoBanner() {
    fetch("/api/auth/dismiss-demo", { method: "POST" }).catch(() => {});
    setShowDemoBanner(false);
  }

  // Any proper subset of branches scopes the overview. Selecting every branch
  // is represented by no filter so legacy single-location accounts stay simple.
  const { selectedIds: scopedLocationIds, locations: scopedLocations } = useLocationScope();
  const locationFilterKey = scopedLocations.length > 0 && scopedLocationIds.length < scopedLocations.length
    ? scopedLocationIds.join(",")
    : "";

  const load = useCallback(async () => {
    if (userLoading) return;
    if (!bizId) {
      setLoading(false);
      return;
    }
    setLoading(true); setError("");
    try {
      setOverview(await api.business.dashboardOverview(bizId, locationFilterKey ? locationFilterKey.split(",") : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.loadFailed);
    } finally { setLoading(false); }
  // React Compiler needs `user` here because `bizId` is derived from it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, user, bizId, locationFilterKey]);

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
      <button onClick={load} className="text-violet-600 hover:underline text-sm">{copy.retry}</button>
    </div>
  );

  if (!overview) return null;

  const now = new Date();
  const timezone = overview.timezone || "UTC";
  const hour = hourInZone(now, timezone);
  const greeting = hour < 12 ? copy.greetings.morning : hour < 17 ? copy.greetings.afternoon : copy.greetings.evening;
  const today = overview.today;
  const upcoming = overview.upcoming;
  const metrics = overview.metrics;
  const actions = [
    { label: copy.actions[0], value: metrics.pendingBookings, href: "/dashboard/appointments", icon: CalendarDays, tone: "bg-amber-50 text-amber-700", card: "border-amber-200 bg-amber-50/60 hover:bg-amber-50" },
    { label: copy.actions[1], value: metrics.unreadMessages, href: "/dashboard/messages", icon: MessageSquare, tone: "bg-violet-50 text-violet-700", card: "border-violet-200 bg-violet-50/60 hover:bg-violet-50" },
    { label: copy.actions[2], value: metrics.unreadNotifications, href: "/dashboard/notifications", icon: Bell, tone: "bg-blue-50 text-blue-700", card: "border-blue-200 bg-blue-50/60 hover:bg-blue-50" },
    ...(!isStaff ? [
      { label: copy.actions[3], value: metrics.failedPayments, href: "/dashboard/transactions", icon: CreditCard, tone: "bg-red-50 text-red-700", card: "border-red-200 bg-red-50/60 hover:bg-red-50" },
      { label: copy.actions[4], value: metrics.waitlistCount, href: "/dashboard/waitlist", icon: TimerReset, tone: "bg-emerald-50 text-emerald-700", card: "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50" },
      { label: copy.actions[5], value: metrics.failedDeliveries, href: "/dashboard/notifications", icon: MailWarning, tone: "bg-red-50 text-red-700", card: "border-red-200 bg-red-50/60 hover:bg-red-50" },
    ] : []),
  ].filter((a) => a.value > 0);

  return (
    <div className="max-w-5xl mx-auto min-w-0 space-y-5 sm:space-y-6">

      {!isStaff && <ErrorBoundary><OnboardingWizard setup={overview.setup} /></ErrorBoundary>}

      {showDemoBanner && (
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-sky-50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Sparkles className="w-6 h-6 text-violet-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-900">{copy.demoTitle}</p>
            <p className="text-xs text-violet-700 mt-0.5">{copy.demoBody}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadDemoData}
              disabled={seedingDemo}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
            >
              {seedingDemo ? dictionary.common.loading : copy.loadDemo}
            </button>
            <button type="button" onClick={dismissDemoBanner} aria-label={copy.dismissDemo} className="p-1.5 text-violet-400 hover:text-violet-700 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900">
            {greeting}{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatDateInZone(now, timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" }, locale)}
          </p>
        </div>
        <Link href="/dashboard/appointments"
          className="text-sm text-violet-600 font-medium flex items-center gap-1 hover:underline">
          {copy.allAppointments} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Quick actions — the handful of things an owner does most, one tap away. */}
      {!isStaff && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: copy.quickActions[0], href: "/dashboard/appointments?new=1", icon: CalendarDays },
            { label: copy.quickActions[1], href: "/dashboard/checkout", icon: CreditCard },
            { label: copy.quickActions[2], href: "/dashboard/booking-page", icon: Globe },
            { label: copy.quickActions[3], href: "/dashboard/clients", icon: Users },
          ].map(({ label, href, icon: Icon }) => (
            <Link key={label} href={href}
              className="flex items-center gap-2.5 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm hover:border-violet-200 hover:bg-violet-50/40 transition-colors">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-gray-800">{label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Setup status chips — a quick trust signal that billing & calendar are live. */}
      {!isStaff && (calSync !== null || payoutsReady !== null) && (
        <div className="flex flex-wrap gap-2">
          {payoutsReady !== null && (
            payoutsReady ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> {copy.setup.payoutsActive}
              </span>
            ) : (
              <Link href="/dashboard/settings?tab=payouts" className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
                <CreditCard className="w-3.5 h-3.5" /> {copy.setup.setupPayouts}
              </Link>
            )
          )}
          {calSync !== null && (
            calSync.connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> {copy.setup.calendarSynced}
              </span>
            ) : (
              <Link href="/dashboard/settings?tab=calendar" className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
                <CalendarDays className="w-3.5 h-3.5" /> {copy.setup.connectCalendar}
              </Link>
            )
          )}
        </div>
      )}

      {actions.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-gray-900">{copy.actionNeeded}</h3>
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
            <p className="text-sm font-semibold text-violet-900">{copy.verification.title}</p>
            <p className="text-xs text-violet-700 mt-0.5">{copy.verification.body}</p>
          </div>
          <Link href="/dashboard/settings"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors">
            {copy.verification.cta}
          </Link>
        </div>
      )}
      {!isStaff && overview.verificationStatus === "PENDING" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">{copy.verification.pending}</p>
        </div>
      )}

      {/* Metrics */}
      {!isStaff && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard label={copy.metrics[0]} value={formatCurrency(metrics.weekRevenue)}
            icon={TrendingUp} accent="bg-emerald-50 text-emerald-600" />
          <MetricCard label={copy.metrics[1]} value={today.length}
            icon={CalendarDays} accent="bg-blue-50 text-blue-600" />
          <MetricCard label={copy.metrics[2]} value={metrics.completedThisWeek}
            icon={CheckCircle2} accent="bg-amber-50 text-amber-600" />
          <MetricCard label={copy.metrics[3]} value={metrics.newClientsThisMonth}
            icon={Users} accent="bg-violet-50 text-violet-600" />
        </div>
      )}

      {/* Live schedule + stats grid */}
      <div className="grid md:grid-cols-5 gap-5">

        {/* Today timeline */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{copy.todaySchedule}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{today.length} {today.length === 1 ? copy.appointment : copy.appointments}</p>
            </div>
            <span className="text-xs font-semibold text-white bg-violet-600 rounded-full px-2.5 py-1">
              {formatDateInZone(now, timezone, { month: "short", day: "numeric" }, locale)}
            </span>
          </div>
          <div className="px-5 max-h-80 overflow-y-auto">
            {today.length === 0 ? (
              <p className="py-10 text-sm text-gray-400 text-center">{copy.nothingToday}</p>
            ) : today.map((apt) => <TimelineSlot key={apt.id} apt={apt} timezone={timezone} locale={locale} />)}
          </div>
          <div className="px-5 py-3 border-t border-gray-50">
            <Link href="/dashboard/appointments"
              className="text-xs text-violet-600 font-medium flex items-center gap-1 hover:underline">
              {copy.viewManageAll} <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Upcoming + quick stats */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">{copy.comingUp}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{copy.nextUpcoming.replace("{count}", String(upcoming.length))}</p>
          </div>
          {!isStaff && (
            <Link href="/dashboard/reports"
              className="flex items-center justify-between px-5 py-2.5 border-b border-gray-100 text-xs font-medium text-violet-600 hover:bg-violet-50/40 transition-colors">
              <span className="text-gray-500">{copy.reportSummary}</span>
              <span className="flex items-center gap-1">{copy.viewReports} <ArrowRight className="w-3 h-3" /></span>
            </Link>
          )}
          <div className={`divide-y divide-gray-50 overflow-y-auto ${isStaff ? "max-h-80" : "max-h-64"}`}>
            {upcoming.length === 0 ? (
              <p className="py-10 text-sm text-gray-400 text-center">{copy.noUpcoming}</p>
            ) : upcoming.map((apt) => (
              <div key={apt.id} className="px-5 py-3">
                <p className="text-xs font-semibold text-violet-600">
                  {formatDateInZone(apt.startsAt, timezone, { weekday: "short", month: "short", day: "numeric" }, locale)} · {formatTimeInZone(apt.startsAt, timezone, locale)}
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
