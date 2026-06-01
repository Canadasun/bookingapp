"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format, isToday, isThisWeek, isThisMonth } from "date-fns";
import { TrendingUp, Users, ChevronRight, ArrowRight, CalendarDays, CheckCircle2 } from "lucide-react";
import { api, Appointment, ClientWithStats } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { SkeletonMetric, SkeletonRow } from "@/components/Skeleton";
import { formatPrice } from "@/lib/utils";
import { getUser } from "@/lib/auth";

function MetricCard({ label, value, icon: Icon, accent }: {
  label: string; value: string | number; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function TimelineSlot({ apt }: { apt: Appointment }) {
  const start = new Date(apt.startsAt);
  const end   = new Date(apt.endsAt);
  const past  = end < new Date();
  return (
    <div className={`flex items-start gap-3 py-3 border-b border-gray-50 last:border-0 ${past ? "opacity-50" : ""}`}>
      <div className="w-14 shrink-0 text-right pt-0.5">
        <span className="text-xs font-semibold text-gray-500">{format(start, "h:mm")}</span>
        <span className="text-xs text-gray-400">{format(start, "a")}</span>
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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients]   = useState<ClientWithStats[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const user    = getUser();
  const isStaff = user?.role === "STAFF";
  const bizId   = user?.businessId ?? "";

  const load = useCallback(async () => {
    if (!bizId) {
      setLoading(false);
      return;
    }
    setLoading(true); setError("");
    try {
      const [aptsRes, clsRes] = await Promise.all([
        api.appointments.list(bizId),
        isStaff ? Promise.resolve({ data: [] as ClientWithStats[] }) : api.clients.list(bizId),
      ]);
      const filtered = isStaff && user?.staffId
        ? aptsRes.data.filter((a) => a.staff.id === user.staffId)
        : aptsRes.data;
      setAppointments(filtered); setClients(clsRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }, [isStaff, user?.staffId, bizId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><SkeletonMetric /><SkeletonMetric /><SkeletonMetric /><SkeletonMetric /></div>
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

  const now    = new Date();
  const today  = appointments
    .filter((a) => isToday(new Date(a.startsAt)))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const upcoming = appointments
    .filter((a) => ["PENDING","CONFIRMED"].includes(a.status) && !isToday(new Date(a.startsAt)) && new Date(a.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 5);
  const weekCompleted = appointments
    .filter((a) => a.status === "COMPLETED" && isThisWeek(new Date(a.startsAt)));
  const weekRevenue  = weekCompleted.reduce((s, a) => s + a.service.priceCents, 0);
  const newThisMonth = clients.filter((c) => isThisMonth(new Date(c.createdAt))).length;
  const greeting = now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening";

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Good {greeting}{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">{format(now, "EEEE, MMMM d, yyyy")}</p>
        </div>
        <Link href="/dashboard/appointments"
          className="text-sm text-violet-600 font-medium flex items-center gap-1 hover:underline">
          All appointments <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Metrics */}
      {!isStaff && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Revenue this week" value={formatPrice(weekRevenue)}
            icon={TrendingUp} accent="bg-emerald-50 text-emerald-600" />
          <MetricCard label="Appointments today" value={today.length}
            icon={CalendarDays} accent="bg-blue-50 text-blue-600" />
          <MetricCard label="Completed this week" value={weekCompleted.length}
            icon={CheckCircle2} accent="bg-amber-50 text-amber-600" />
          <MetricCard label="New clients this month" value={newThisMonth}
            icon={Users} accent="bg-violet-50 text-violet-600" />
        </div>
      )}

      {/* Timeline + Upcoming grid */}
      <div className="grid md:grid-cols-5 gap-5">

        {/* Today timeline */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-gray-50">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Today&apos;s schedule</h3>
              <p className="text-xs text-gray-400 mt-0.5">{today.length} appointment{today.length !== 1 ? "s" : ""}</p>
            </div>
            <span className="text-xs font-semibold text-white bg-violet-600 rounded-full px-2.5 py-1">
              {format(now, "MMM d")}
            </span>
          </div>
          <div className="px-5 max-h-80 overflow-y-auto">
            {today.length === 0 ? (
              <p className="py-10 text-sm text-gray-400 text-center">Nothing scheduled today</p>
            ) : today.map((apt) => <TimelineSlot key={apt.id} apt={apt} />)}
          </div>
          <div className="px-5 py-3 border-t border-gray-50">
            <Link href="/dashboard/appointments"
              className="text-xs text-violet-600 font-medium flex items-center gap-1 hover:underline">
              View &amp; manage all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Upcoming */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Coming up</h3>
            <p className="text-xs text-gray-400 mt-0.5">Next {upcoming.length} upcoming</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {upcoming.length === 0 ? (
              <p className="py-10 text-sm text-gray-400 text-center">No upcoming appointments</p>
            ) : upcoming.map((apt) => (
              <div key={apt.id} className="px-5 py-3">
                <p className="text-xs font-semibold text-violet-600">{format(new Date(apt.startsAt), "EEE, MMM d · h:mm a")}</p>
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
