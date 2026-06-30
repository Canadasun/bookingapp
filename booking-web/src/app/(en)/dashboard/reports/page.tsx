"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, Users, CalendarCheck, XCircle, RefreshCw, ShieldCheck, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useLocationScope } from "@/lib/location-scope";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { useDashboardLocale } from "@/lib/dashboard-locale";

function pct(n: number, d: number) { return d === 0 ? 0 : Math.round((n / d) * 100); }

type ReportData = {
  gated: false;
  plan: string;
  currency: string;
  locationScoped?: boolean;
  outcomes: { total: number; completed: number; cancelled: number; noShow: number; pending: number; confirmed: number };
  collectedCents: number;
  revenueProtectedCents: number;
  depositsCollectedCents: number;
  noShowFeesCents: number;
  cancelFeesCents: number;
  byMonth: { label: string; cents: number }[];
  newClients30d: number;
  topServices: { name: string; count: number }[];
  topStaff: { name: string; count: number }[];
  topClients: { id: string; name: string; totalSpentCents: number; totalVisits: number }[];
};

export default function ReportsPage() {
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const [data, setData] = useState<ReportData | null>(null);
  const [gated, setGated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const { french, formatCurrency } = useDashboardLocale();

  // When a single branch is focused, scope the appointment/revenue metrics to it.
  const { selectedIds: scopedIds, locations: scopeLocs } = useLocationScope();
  const scopedLocationId = scopeLocs.length > 1 && scopedIds.length === 1 ? scopedIds[0] : undefined;
  const scopedLocationName = scopedLocationId ? (scopeLocs.find((l) => l.id === scopedLocationId)?.name ?? null) : null;

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError("");
    setLoading(true);
    try {
      const res = await api.get<{ gated: boolean } | ReportData>(`/businesses/${bizId}/reports${scopedLocationId ? `?locationId=${encodeURIComponent(scopedLocationId)}` : ""}`);
      if (res.gated) { setGated(true); }
      else { setData(res as ReportData); setGated(false); }
    } catch (e) { setLoadError(e instanceof Error ? e.message : (french ? "Échec du chargement des rapports" : "Failed to load reports")); }
    finally { setLoading(false); }
  }, [bizId, scopedLocationId, french]);

  useEffect(() => { load(); }, [load]);

  const money = useCallback((cents: number) => formatCurrency(cents, (data?.currency ?? "CAD") as "CAD" | "USD"), [data?.currency, formatCurrency]);

  if (loading) return <LoadingSpinner />;

  if (loadError) return (
    <div className="text-center py-20">
      <p className="text-red-500 mb-3">{loadError}</p>
      <button onClick={() => { setLoadError(""); load(); }} className="text-violet-600 hover:underline text-sm">{french ? "Réessayer" : "Retry"}</button>
    </div>
  );

  if (gated) return (
    <div className="max-w-md mx-auto text-center py-20 px-4">
      <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-7 h-7 text-violet-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{french ? "Analytique et rapports" : "Analytics & Reports"}</h2>
      <p className="text-sm text-gray-500 mb-2">{french ? <>Passez à <strong>Basic (19 $/mois)</strong> ou plus pour déverrouiller :</> : <>Upgrade to <strong>Basic ($19/mo)</strong> or higher to unlock:</>}</p>
      <ul className="text-sm text-gray-500 mb-6 space-y-1 text-left inline-block">
        <li>• {french ? "Tendances des revenus (12 derniers mois)" : "Revenue trends (last 12 months)"}</li>
        <li>• {french ? "Revenus protégés par Pulse" : "Revenue Protected by Pulse"}</li>
        <li>• {french ? "Meilleurs services et performance des professionnels" : "Top services & provider performance"}</li>
        <li>• {french ? "Meilleurs clients par dépenses" : "Top clients by spend"}</li>
        <li>• {french ? "Taux d’absences et d’annulations" : "No-show & cancellation rates"}</li>
      </ul>
      <div className="flex flex-col gap-3">
        <a href="/dashboard/settings#billing" className="inline-block bg-violet-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-violet-700 transition-colors">
          {french ? "Passer à Basic — 19 $/mois →" : "Upgrade to Basic — $19/mo →"}
        </a>
        <a href="/pricing" className="text-sm text-gray-400 hover:text-gray-600">{french ? "Comparer tous les forfaits" : "Compare all plans"}</a>
      </div>
    </div>
  );

  if (!data) return null;

  const r = data;
  const maxMonth = Math.max(1, ...r.byMonth.map(m => m.cents));

  return (
    <div className="max-w-5xl mx-auto min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900">{french ? "Rapports" : "Reports"}</h2>
          <p className="text-sm text-gray-500">{french ? "Rendement global · revenus des 12 derniers mois" : "All-time performance · last 12 months revenue"}</p>
          {data?.locationScoped && scopedLocationName && (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
              {french ? <>Affichage de {scopedLocationName} · rendez-vous et revenus uniquement</> : <>Showing {scopedLocationName} · appointments &amp; revenue only</>}
            </span>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="w-4 h-4" /> {french ? "Actualiser" : "Refresh"}
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: french ? "Revenus collectés (12 mois)" : "Collected revenue (12 mo)", value: money(r.collectedCents), icon: TrendingUp, tone: "emerald" },
          { label: french ? "Rendez-vous terminés" : "Completed appointments", value: `${r.outcomes.completed}`, sub: `${pct(r.outcomes.completed, r.outcomes.total)}% ${french ? "de" : "of"} ${r.outcomes.total}`, icon: CalendarCheck, tone: "violet" },
          { label: french ? "Nouveaux clients (30 j)" : "New clients (30d)", value: `${r.newClients30d}`, sub: r.locationScoped ? (french ? "entreprise entière" : "business-wide") : undefined, icon: Users, tone: "amber" },
          { label: french ? "Taux d’absences" : "No-show rate", value: `${pct(r.outcomes.noShow, r.outcomes.total)}%`, sub: `${r.outcomes.noShow} ${french ? "absences" : "no-shows"}`, icon: XCircle, tone: "red" },
        ].map((k) => {
          const Icon = k.icon;
          const tone: Record<string, string> = {
            emerald: "bg-emerald-50 text-emerald-700",
            violet: "bg-violet-50 text-violet-700",
            amber: "bg-amber-50 text-amber-700",
            red: "bg-red-50 text-red-600",
          };
          return (
            <div key={k.label} className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2", tone[k.tone])}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="max-w-full truncate text-xl sm:text-2xl font-bold text-gray-900 leading-none tabular-nums">{k.value}</p>
              <p className="text-xs text-gray-500 mt-1">{k.label}</p>
              {k.sub && <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* Revenue Protected */}
      <div className="rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-900">{french ? "Revenus protégés par Pulse" : "Revenue Protected by Pulse"}</p>
              <p className="text-xs text-green-700 mt-0.5">
                {french ? "Acomptes + frais d’absence + frais d’annulation tardive — de l’argent que vous auriez perdu sans protection." : "Deposits + no-show fees + late-cancel fees — money you would have lost without protection."}
              </p>
            </div>
          </div>
          <p className="text-3xl font-bold text-green-800 tabular-nums shrink-0">{money(r.revenueProtectedCents)}</p>
        </div>
        {r.revenueProtectedCents > 0 ? (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-green-200">
            <div className="text-xs text-green-700"><span className="font-semibold">{money(r.depositsCollectedCents)}</span> {french ? "acomptes" : "deposits"}</div>
            <div className="text-xs text-green-700"><span className="font-semibold">{money(r.noShowFeesCents)}</span> {french ? "frais d’absence" : "no-show fees"}</div>
            <div className="text-xs text-green-700"><span className="font-semibold">{money(r.cancelFeesCents)}</span> {french ? "frais d’annulation tardive" : "late-cancel fees"}</div>
          </div>
        ) : (
          <p className="text-xs text-green-700 mt-3">
            {french ? <>Activez les acomptes ou les frais d’absence dans <a href="/dashboard/settings?tab=booking" className="underline font-medium">Politiques de réservation</a> pour commencer à protéger vos revenus.</> : <>Enable deposits or no-show fees in{" "}<a href="/dashboard/settings?tab=booking" className="underline font-medium">Booking Policies</a>{" "}to start protecting your revenue.</>}
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Revenue by month */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">{french ? "Revenus collectés · 12 derniers mois" : "Collected revenue · last 12 months"}</p>
          <div className="flex items-end justify-between gap-1.5 h-40">
            {r.byMonth.map((m) => (
              <div key={m.label} className="flex-1 flex flex-col items-center justify-end gap-1 h-full min-w-0">
                <div
                  className="w-full rounded-t-md bg-violet-500/90 transition-all"
                  style={{ height: `${Math.max(4, (m.cents / maxMonth) * 100)}%` }}
                  title={money(m.cents)}
                />
                <span className="text-[10px] text-gray-400 truncate w-full text-center">
                  {m.label.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Booking outcomes */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">{french ? "Résultats des réservations (historique)" : "Booking outcomes (all time)"}</p>
          <div className="space-y-3">
            {[
              { label: french ? "Terminés" : "Completed", n: r.outcomes.completed, color: "bg-emerald-500", icon: CalendarCheck },
              { label: french ? "Annulés" : "Cancelled", n: r.outcomes.cancelled, color: "bg-gray-400", icon: XCircle },
              { label: french ? "Absences" : "No-show", n: r.outcomes.noShow, color: "bg-red-400", icon: XCircle },
              { label: french ? "En attente / confirmés" : "Pending / Confirmed", n: r.outcomes.pending + r.outcomes.confirmed, color: "bg-violet-400", icon: CalendarCheck },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600">{row.label}</span>
                  <span className="font-semibold text-gray-800">{row.n} · {pct(row.n, r.outcomes.total)}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={cn("h-full rounded-full", row.color)} style={{ width: `${pct(row.n, r.outcomes.total)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top services */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">{french ? "Meilleurs services (réservations terminées)" : "Top services (by completed bookings)"}</p>
          {r.topServices.length === 0 ? (
            <p className="text-xs text-gray-400">{french ? "Aucun rendez-vous terminé pour l’instant." : "No completed appointments yet."}</p>
          ) : (
            <div className="space-y-2.5">
              {r.topServices.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 truncate">{s.name}</span>
                      <span className="text-gray-500 shrink-0 ml-2">{s.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500"
                        style={{ width: `${pct(s.count, r.topServices[0]?.count ?? 1)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top clients + busiest staff */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">
            {french ? "Meilleurs clients par dépenses" : "Top clients by spend"}
            {r.locationScoped && <span className="ml-1.5 text-xs font-normal text-gray-400">{french ? "(entreprise entière)" : "(business-wide)"}</span>}
          </p>
          {r.topClients.length === 0 ? (
            <p className="text-xs text-gray-400">{french ? "Aucun revenu enregistré pour l’instant." : "No revenue recorded yet."}</p>
          ) : (
            <div className="space-y-2 mb-5">
              {r.topClients.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{c.name}</span>
                  <span className="text-gray-500 shrink-0 ml-2">
                    {money(c.totalSpentCents)} · {c.totalVisits} {french ? `visite${c.totalVisits === 1 ? "" : "s"}` : `visit${c.totalVisits === 1 ? "" : "s"}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-sm font-semibold text-gray-900 mb-3">{french ? "Professionnels les plus occupés" : "Busiest providers"}</p>
          <div className="space-y-2">
            {r.topStaff.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate">{s.name}</span>
                <span className="text-gray-500 shrink-0 ml-2">{s.count} {french ? `réservation${s.count === 1 ? "" : "s"}` : `booking${s.count === 1 ? "" : "s"}`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
