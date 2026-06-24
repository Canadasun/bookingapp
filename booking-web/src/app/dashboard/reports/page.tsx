"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { format, subMonths, startOfMonth, isAfter } from "date-fns";
import { TrendingUp, Users, CalendarCheck, XCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { api, Appointment, ClientWithStats, Payment, Business } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

function pct(n: number, d: number) { return d === 0 ? 0 : Math.round((n / d) * 100); }

export default function ReportsPage() {
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [currency, setCurrency] = useState<"CAD" | "USD">("CAD");
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const money = useCallback((cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100), [currency]);

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try {
      const [a, c, p, b] = await Promise.all([
        api.appointments.listRange(bizId, "2000-01-01T00:00:00.000Z", "2100-01-01T00:00:00.000Z"),
        api.clients.list(bizId, undefined, 1, 500).catch(() => ({ data: [] as ClientWithStats[] })),
        api.payments.list().catch(() => [] as Payment[]),
        api.business.get(bizId).catch(() => null as Business | null),
      ]);
      setAppts(a.data);
      setClients(c.data);
      setPayments(p);
      if (b?.currency) setCurrency(b.currency);
      if (b?.plan) setPlan(b.plan);
    } catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load reports"); }
    finally { setLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const r = useMemo(() => {
    const completed = appts.filter((a) => a.status === "COMPLETED");
    const cancelled = appts.filter((a) => a.status === "CANCELLED");
    const noShow = appts.filter((a) => a.status === "NO_SHOW");
    const serviceValue = completed.reduce((s, a) => s + (a.totalPriceCents ?? a.service.priceCents), 0);
    const collected = payments
      .filter((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED")
      .reduce((s, p) => s + (p.amountCents - (p.refundedCents ?? 0)), 0);
    const thirtyAgo = subMonths(new Date(), 1);
    const newClients = clients.filter((c) => isAfter(new Date(c.createdAt), thirtyAgo)).length;

    // Actual collected revenue by month, net of successful refunds.
    const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
    const byMonth = months.map((m) => {
      const key = format(m, "yyyy-MM");
      const cents = payments
        .filter((p) => (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") && format(new Date(p.createdAt), "yyyy-MM") === key)
        .reduce((s, p) => s + p.amountCents - (p.refundedCents ?? 0), 0);
      return { label: format(m, "MMM"), cents };
    });
    const maxMonth = Math.max(1, ...byMonth.map((m) => m.cents));

    // Top services by bookings + revenue.
    const svc = new Map<string, { name: string; count: number; cents: number }>();
    for (const a of appts) {
      const e = svc.get(a.service.id) ?? { name: a.service.name, count: 0, cents: 0 };
      e.count += 1;
      if (a.status === "COMPLETED") e.cents += (a.totalPriceCents ?? a.service.priceCents);
      svc.set(a.service.id, e);
    }
    const topServices = Array.from(svc.values()).sort((a, b) => b.count - a.count).slice(0, 5);

    // Busiest providers by bookings.
    const stf = new Map<string, { name: string; count: number }>();
    for (const a of appts) {
      const e = stf.get(a.staff.id) ?? { name: a.staff.user.name, count: 0 };
      e.count += 1; stf.set(a.staff.id, e);
    }
    const topStaff = Array.from(stf.values()).sort((a, b) => b.count - a.count).slice(0, 5);

    const topClients = [...clients].sort((a, b) => b.totalSpentCents - a.totalSpentCents).slice(0, 5).filter((c) => c.totalSpentCents > 0);

    // Revenue Protected = deposits collected + no-show fees + late-cancellation fees.
    // This shows businesses the tangible financial benefit of Pulse's protection features.
    const revenueProtected = payments
      .filter((p) => (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") && (p.kind === "DEPOSIT" || p.kind === "NO_SHOW_FEE" || p.kind === "LATE_CANCEL_FEE"))
      .reduce((s, p) => s + p.amountCents - (p.refundedCents ?? 0), 0);
    const depositsCollected = payments
      .filter((p) => (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") && p.kind === "DEPOSIT")
      .reduce((s, p) => s + p.amountCents - (p.refundedCents ?? 0), 0);
    const noShowFees = payments
      .filter((p) => (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") && p.kind === "NO_SHOW_FEE")
      .reduce((s, p) => s + p.amountCents - (p.refundedCents ?? 0), 0);
    const cancelFees = payments
      .filter((p) => (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") && p.kind === "LATE_CANCEL_FEE")
      .reduce((s, p) => s + p.amountCents - (p.refundedCents ?? 0), 0);

    return { total: appts.length, completed: completed.length, cancelled: cancelled.length, noShow: noShow.length,
      serviceValue, collected, newClients, byMonth, maxMonth, topServices, topStaff, topClients,
      revenueProtected, depositsCollected, noShowFees, cancelFees };
  }, [appts, clients, payments]);

  if (loading) return <LoadingSpinner />;
  if (loadError) return (
    <div className="text-center py-20">
      <p className="text-red-500 mb-3">{loadError}</p>
      <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">Retry</button>
    </div>
  );
  if (plan && plan !== "PRO" && plan !== "UNLIMITED") return (
    <div className="max-w-md mx-auto text-center py-20 px-4">
      <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
        <TrendingUp className="w-7 h-7 text-violet-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Analytics is a Pro feature</h2>
      <p className="text-sm text-gray-500 mb-6">Upgrade to Pro or Unlimited to access revenue trends, top services, provider performance, and client insights.</p>
      <a href="/dashboard/settings#billing" className="inline-block bg-violet-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-violet-700 transition-colors">Upgrade to Pro →</a>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500">Performance across all your appointments</p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} className="gap-1.5"><RefreshCw className="w-4 h-4" /> Refresh</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Collected revenue", value: money(r.collected), icon: TrendingUp, tone: "emerald" },
          { label: "Completed service value", value: money(r.serviceValue), icon: TrendingUp, tone: "violet" },
          { label: "Completed", value: `${r.completed}`, sub: `${pct(r.completed, r.total)}% of ${r.total}`, icon: CalendarCheck, tone: "violet" },
          { label: "New clients (30d)", value: `${r.newClients}`, icon: Users, tone: "amber" },
        ].map((k) => {
          const Icon = k.icon;
          const tone: Record<string, string> = { emerald: "bg-emerald-50 text-emerald-700", violet: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-700" };
          return (
            <div key={k.label} className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2", tone[k.tone])}><Icon className="w-4 h-4" /></div>
              <p className="max-w-full truncate text-xl sm:text-2xl font-bold text-gray-900 leading-none tabular-nums">{k.value}</p>
              <p className="text-xs text-gray-500 mt-1">{k.label}</p>
              {k.sub && <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* Revenue Protected card — highlights the value of Pulse's no-show protection */}
      <div className="rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-900">Revenue Protected by Pulse</p>
              <p className="text-xs text-green-700 mt-0.5">Deposits collected + no-show fees + late-cancellation fees — money you would have lost without protection.</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-green-800 tabular-nums shrink-0">{money(r.revenueProtected)}</p>
        </div>
        {r.revenueProtected > 0 && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-green-200">
            <div className="text-xs text-green-700"><span className="font-semibold">{money(r.depositsCollected)}</span> deposits</div>
            <div className="text-xs text-green-700"><span className="font-semibold">{money(r.noShowFees)}</span> no-show fees</div>
            <div className="text-xs text-green-700"><span className="font-semibold">{money(r.cancelFees)}</span> late-cancel fees</div>
            <div className="text-xs text-green-700"><span className="font-semibold">{r.noShow}</span> no-shows</div>
          </div>
        )}
        {r.revenueProtected === 0 && (
          <p className="text-xs text-green-700 mt-3">Enable deposits or no-show fees in <a href="/dashboard/settings?tab=booking" className="underline font-medium">Booking Policies</a> to start protecting your revenue.</p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Revenue by month */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">Collected revenue · last 6 months</p>
          <div className="flex items-end justify-between gap-2 h-40">
            {r.byMonth.map((m) => (
              <div key={m.label} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                <div className="w-full rounded-t-lg bg-violet-500/90 transition-all" style={{ height: `${Math.max(4, (m.cents / r.maxMonth) * 100)}%` }} title={money(m.cents)} />
                <span className="text-[11px] text-gray-400">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Booking outcomes */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">Booking outcomes</p>
          <div className="space-y-3">
            {[
              { label: "Completed", n: r.completed, color: "bg-emerald-500", icon: CalendarCheck },
              { label: "Cancelled", n: r.cancelled, color: "bg-gray-400", icon: XCircle },
              { label: "No-show", n: r.noShow, color: "bg-red-400", icon: XCircle },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">{row.label}</span>
                  <span className="font-semibold text-gray-800">{row.n} · {pct(row.n, r.total)}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={cn("h-full rounded-full", row.color)} style={{ width: `${pct(row.n, r.total)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top services */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Top services</p>
          {r.topServices.length === 0 ? <p className="text-xs text-gray-400">No data yet.</p> : (
            <div className="space-y-2">
              {r.topServices.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{s.name}</span>
                  <span className="text-gray-500 shrink-0">{s.count} booking{s.count === 1 ? "" : "s"} · {money(s.cents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top clients + busiest staff */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Top clients</p>
          {r.topClients.length === 0 ? <p className="text-xs text-gray-400">No spend recorded yet.</p> : (
            <div className="space-y-2 mb-4">
              {r.topClients.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{c.name}</span>
                  <span className="text-gray-500 shrink-0">{money(c.totalSpentCents)} · {c.totalVisits} visit{c.totalVisits === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm font-semibold text-gray-900 mb-3 mt-4">Busiest providers</p>
          <div className="space-y-2">
            {r.topStaff.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate">{s.name}</span>
                <span className="text-gray-500 shrink-0">{s.count} booking{s.count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
