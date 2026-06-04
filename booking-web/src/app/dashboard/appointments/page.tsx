"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { format, isToday, isThisWeek } from "date-fns";
import { RefreshCw, Search, X, CheckCircle, XCircle, AlertCircle, CheckSquare, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { api, Appointment } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { formatPrice, cn } from "@/lib/utils";

type Tab = "today" | "week" | "all";
type ViewMode = "list" | "staff";

// Turn the API's cancellation-fee reason code into something an owner can read.
function feeReasonText(reason: string): string {
  return ({
    no_card: "no card is on file for this client",
    plan_requires_pro: "automatic fees require the Pro plan",
    no_fee: "no cancellation fee is configured",
    charge_failed: "the card was declined",
    not_found: "the appointment couldn't be found",
  } as Record<string, string>)[reason] ?? "it couldn't be charged";
}

function AppointmentDrawer({ apt, onClose, onAction }: {
  apt: Appointment;
  onClose: () => void;
  onAction: (action: string, id: string, extra?: Record<string, string>) => Promise<void>;
}) {
  const [cancelReason, setCancelReason] = useState("");
  const [chargeFee, setChargeFee] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  // Owner can enforce the cancellation fee only when the business is on Pro with a
  // fee configured (a card must also be on file — the API verifies that and tells
  // us if it couldn't charge).
  const feeEligible = apt.business?.plan === "PRO" && (apt.business?.cancellationFeeCents ?? 0) > 0;
  const [edit, setEdit] = useState({
    clientName: apt.client.name,
    clientEmail: apt.client.email,
    clientPhone: apt.client.phone ?? "",
    startsAt: format(new Date(apt.startsAt), "yyyy-MM-dd'T'HH:mm"),
    notes: apt.notes ?? "",
    notifyClient: "true",
  });
  const [acting, setActing] = useState<string | null>(null);

  async function act(action: string, extra?: Record<string, string>) {
    setActing(action);
    await onAction(action, apt.id, extra);
    setActing(null);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Appointment details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status */}
          <div className="flex items-center gap-2">
            <StatusBadge status={apt.status} />
            {apt.cancelReason && <span className="text-xs text-gray-500 italic">&quot;{apt.cancelReason}&quot;</span>}
          </div>

          {/* Datetime */}
          <div className="bg-violet-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-violet-800">
              {format(new Date(apt.startsAt), "EEEE, MMMM d, yyyy")}
            </p>
            <p className="text-sm text-violet-600 mt-0.5">
              {format(new Date(apt.startsAt), "HH:mm")} - {format(new Date(apt.endsAt), "HH:mm")}
            </p>
          </div>

          {/* Details */}
          {[
            { label: "Service",  value: `${apt.service.name} (${apt.service.durationMinutes} min)` },
            { label: "Price",    value: formatPrice(apt.service.priceCents) },
            { label: "Staff",    value: apt.staff.user.name },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-900">{value}</span>
            </div>
          ))}

          <hr className="border-gray-100" />

          {/* Client */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Client</p>
            <p className="font-semibold text-gray-900">{apt.client.name}</p>
            <p className="text-sm text-gray-500">{apt.client.email}</p>
            {apt.client.phone && <p className="text-sm text-gray-500">{apt.client.phone}</p>}
          </div>

          {/* Notes */}
          {apt.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{apt.notes}</p>
            </div>
          )}

          {/* Deposit */}
          {apt.depositCents && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Deposit collected</span>
              <span className="font-medium text-emerald-600">{formatPrice(apt.depositCents)}</span>
            </div>
          )}

          {/* Cancel form */}
          {showCancelForm && (
            <div className="space-y-2">
              <Input placeholder="Reason for cancellation (optional)" value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)} />
              {feeEligible && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={chargeFee}
                    onChange={(e) => setChargeFee(e.target.checked)}
                    className="h-4 w-4 accent-violet-600"
                  />
                  Charge the {formatPrice(apt.business.cancellationFeeCents)} cancellation fee to the client&apos;s card
                </label>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => setShowCancelForm(false)}>Back</Button>
                <Button size="sm" variant="destructive" className="flex-1" loading={acting === "cancel"}
                  onClick={() => act("cancel", { ...(cancelReason ? { cancelReason } : {}), ...(chargeFee ? { chargeFee: "true" } : {}) })}>
                  Confirm cancel
                </Button>
              </div>
            </div>
          )}

          {showEditForm && (
            <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Edit booking</p>
              <Input value={edit.clientName} onChange={(e) => setEdit((p) => ({ ...p, clientName: e.target.value }))} placeholder="Client name" />
              <Input type="email" value={edit.clientEmail} onChange={(e) => setEdit((p) => ({ ...p, clientEmail: e.target.value }))} placeholder="Client email" />
              <Input value={edit.clientPhone} onChange={(e) => setEdit((p) => ({ ...p, clientPhone: e.target.value }))} placeholder="Client phone" />
              <Input type="datetime-local" value={edit.startsAt} onChange={(e) => setEdit((p) => ({ ...p, startsAt: e.target.value }))} />
              <Input value={edit.notes} onChange={(e) => setEdit((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={edit.notifyClient === "true"}
                  onChange={(e) => setEdit((p) => ({ ...p, notifyClient: e.target.checked ? "true" : "false" }))}
                  className="h-4 w-4 accent-violet-600"
                />
                Notify client by email
              </label>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => setShowEditForm(false)}>Back</Button>
                <Button size="sm" className="flex-1" loading={acting === "edit"} onClick={() => act("edit", edit)}>
                  Save changes
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {!showCancelForm && !showEditForm && (
          <div className="px-6 py-4 border-t border-gray-100 space-y-2">
            <Button className="w-full gap-2" variant="secondary" onClick={() => setShowEditForm(true)}>
              Edit appointment
            </Button>
            {apt.status === "PENDING" && (
              <Button className="w-full gap-2" loading={acting === "confirm"}
                onClick={() => act("confirm")}>
                <CheckCircle className="w-4 h-4" /> Confirm appointment
              </Button>
            )}
            {apt.status === "CONFIRMED" && (
              <Button className="w-full gap-2" variant="secondary" loading={acting === "complete"}
                onClick={() => act("complete")}>
                <CheckSquare className="w-4 h-4" /> Mark completed
              </Button>
            )}
            {["PENDING","CONFIRMED"].includes(apt.status) && (
              <Button className="w-full gap-2" variant="destructive" onClick={() => setShowCancelForm(true)}>
                <XCircle className="w-4 h-4" /> Cancel appointment
              </Button>
            )}
            {apt.status === "CONFIRMED" && (
              <Button className="w-full gap-2" variant="ghost" loading={acting === "noshow"}
                onClick={() => act("noshow")}>
                <AlertCircle className="w-4 h-4" /> Mark no-show
              </Button>
            )}
            {apt.status === "NO_SHOW" && !apt.depositCents && (
              <Button className="w-full gap-2" variant="ghost" loading={acting === "noshow-fee"}
                onClick={() => act("noshow-fee")}>
                <DollarSign className="w-4 h-4" /> Charge no-show fee
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function AppointmentsPage() {
  const user = getUser();
  const isStaff = user?.role === "STAFF";
  const bizId = user?.businessId ?? "";

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("today");
  const [search, setSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<Appointment | null>(null);

  const load = useCallback(async () => {
    if (!bizId) {
      setLoading(false);
      return;
    }
    setLoading(true); setError("");
    try {
      const res = await api.appointments.list(bizId);
      const filtered = isStaff && user?.staffId
        ? res.data.filter((a) => a.staff.id === user.staffId)
        : res.data;
      setAppointments(filtered);
    }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [isStaff, user?.staffId, bizId]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(action: string, id: string, extra?: Record<string, string>) {
    if (!bizId) return;
    try {
      if (action === "confirm")    await api.appointments.confirm(bizId, id);
      else if (action === "cancel") {
        const res = await api.appointments.updateStatus(bizId, id, "CANCELLED", extra?.cancelReason, extra?.chargeFee === "true");
        if (extra?.chargeFee === "true") {
          if (res.cancelFee?.charged) toast.success(`Cancelled — charged ${formatPrice(res.cancelFee.feeCents)} cancellation fee`);
          else toast.error(`Cancelled, but the fee wasn't charged${res.cancelFee?.reason ? ` — ${feeReasonText(res.cancelFee.reason)}` : ""}`);
          setSelected(null); load(); return;
        }
      }
      else if (action === "complete") await api.appointments.updateStatus(bizId, id, "COMPLETED");
      else if (action === "noshow") await api.appointments.updateStatus(bizId, id, "NO_SHOW");
      else if (action === "edit" && extra) {
        await api.appointments.update(bizId, id, {
          clientName: extra.clientName,
          clientEmail: extra.clientEmail,
          clientPhone: extra.clientPhone,
          startsAt: extra.startsAt ? new Date(extra.startsAt).toISOString() : undefined,
          notes: extra.notes,
          notifyClient: extra.notifyClient !== "false",
        });
      }
      else if (action === "noshow-fee") {
        const res = await api.payments.chargeNoShow(id);
        if (res.charged) toast.success(`Charged no-show fee of ${formatPrice(res.feeCents)}`);
        else toast.error(res.message ?? "Could not charge the no-show fee");
        setSelected(null);
        load();
        return;
      }
      toast.success("Updated");
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  }

  const staffNames = useMemo(() =>
    [...new Set(appointments.map((a) => a.staff.user.name))].sort(), [appointments]);

  const filtered = useMemo(() => {
    let list = appointments;
    if (tab === "today") list = list.filter((a) => isToday(new Date(a.startsAt)));
    else if (tab === "week") list = list.filter((a) => isThisWeek(new Date(a.startsAt)));
    if (staffFilter) list = list.filter((a) => a.staff.user.name === staffFilter);
    if (statusFilter) list = list.filter((a) => a.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.client.name.toLowerCase().includes(q) ||
        a.client.email.toLowerCase().includes(q) ||
        (a.client.phone ?? "").includes(q)
      );
    }
    return [...list].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [appointments, tab, staffFilter, statusFilter, search]);

  const staffGroups = useMemo(() => {
    const groups = new Map<string, Appointment[]>();
    for (const apt of filtered) {
      const name = apt.staff.user.name;
      groups.set(name, [...(groups.get(name) ?? []), apt]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Appointments</h2>
          <p className="text-sm text-gray-500">{appointments.length} total</p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(["today","week","all"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                tab === t ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700")}>
              {t === "all" ? "All" : t === "week" ? "This week" : "Today"}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search client…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9" />
        </div>

        <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700">
          <option value="">All staff</option>
          {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700">
          <option value="">All statuses</option>
          {["PENDING","CONFIRMED","CANCELLED","COMPLETED","NO_SHOW"].map((s) =>
            <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(["list","staff"] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setViewMode(v)}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                viewMode === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
              {v === "list" ? "List" : "Staff board"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-center py-8">
          <p className="text-red-500 mb-2">{error}</p>
          <button onClick={load} className="text-violet-600 text-sm hover:underline">Retry</button>
        </div>
      )}

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState title="No appointments" description="Try adjusting your filters." />
      ) : viewMode === "staff" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {staffGroups.map(([name, rows]) => (
            <div key={name} className="rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">{name}</p>
                <p className="text-xs text-gray-400">{rows.length} appointment{rows.length === 1 ? "" : "s"}</p>
              </div>
              <div className="max-h-[520px] divide-y divide-gray-50 overflow-y-auto">
                {rows.map((apt) => (
                  <button key={apt.id} onClick={() => setSelected(apt)} className="block w-full px-4 py-3 text-left hover:bg-gray-50">
                    <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{format(new Date(apt.startsAt), "EEE HH:mm")}</p>
                      <StatusBadge status={apt.status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-700">{apt.client.name}</p>
                    <p className="truncate text-xs text-gray-500">{apt.service.name}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((apt) => (
            <Card key={apt.id} className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelected(apt)}>
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{apt.client.name}</span>
                    <StatusBadge status={apt.status} />
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{apt.service.name} · {apt.staff.user.name}</p>
                  <p className="text-sm font-medium text-violet-600 mt-0.5">
                    {format(new Date(apt.startsAt), "EEE, MMM d · HH:mm")} - {format(new Date(apt.endsAt), "HH:mm")}
                  </p>
                </div>
                <div className="text-xs text-gray-400 shrink-0">{formatPrice(apt.service.priceCents)}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <AppointmentDrawer
          apt={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
        />
      )}
    </div>
  );
}
