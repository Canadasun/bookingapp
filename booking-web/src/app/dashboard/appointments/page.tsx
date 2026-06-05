"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  format, isToday, isThisWeek,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, addMonths, subMonths, addDays, addWeeks, subWeeks, isSameDay,
} from "date-fns";
import { RefreshCw, Search, X, CheckCircle, XCircle, AlertCircle, CheckSquare, DollarSign, ChevronLeft, ChevronRight, CalendarOff, Trash2 } from "lucide-react";
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
type ViewMode = "list" | "staff" | "calendar" | "week";

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

          {/* Intake / consultation answers */}
          {apt.intakeAnswers && apt.intakeAnswers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Intake form</p>
              <div className="space-y-2">
                {apt.intakeAnswers.map((a, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-gray-500">{a.label}</p>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{a.answer}</p>
                  </div>
                ))}
              </div>
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

const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-amber-400", CONFIRMED: "bg-emerald-500", COMPLETED: "bg-violet-500",
  CANCELLED: "bg-gray-300", NO_SHOW: "bg-red-400",
};

// Month grid view — appointments laid out on a real calendar. Click an entry to
// open the same detail drawer used by the list/board views.
function MonthView({ month, appts, onPrev, onNext, onToday, onSelect }: {
  month: Date; appts: Appointment[];
  onPrev: () => void; onNext: () => void; onToday: () => void;
  onSelect: (a: Appointment) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  });
  const byDay = new Map<string, Appointment[]>();
  for (const a of appts) {
    const k = format(new Date(a.startsAt), "yyyy-MM-dd");
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(a);
  }
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">{format(month, "MMMM yyyy")}</p>
        <div className="flex items-center gap-1">
          <button onClick={onToday} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">Today</button>
          <button onClick={onPrev} aria-label="Previous month" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={onNext} aria-label="Next month" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold text-gray-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const k = format(day, "yyyy-MM-dd");
          const list = (byDay.get(k) ?? []).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
          const inMonth = isSameMonth(day, month);
          return (
            <div key={k} className={cn("min-h-[96px] border-b border-r border-gray-50 p-1.5", !inMonth && "bg-gray-50/40")}>
              <div className={cn("text-xs mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full",
                isToday(day) ? "bg-violet-600 text-white font-bold" : inMonth ? "text-gray-700" : "text-gray-300")}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((a) => (
                  <button key={a.id} onClick={() => onSelect(a)}
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-gray-100">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[a.status] ?? "bg-gray-300")} />
                    <span className="truncate text-[11px] text-gray-700">{format(new Date(a.startsAt), "HH:mm")} {a.client.name}</span>
                  </button>
                ))}
                {list.length > 3 && <p className="px-1 text-[10px] text-gray-400">+{list.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Block off personal/unbookable time for a provider. Backed by the existing
// TimeOff model, which the availability engine already excludes from open slots.
function BlockTimeModal({ bizId, staffList, onClose, onSaved }: {
  bizId: string;
  staffList: { id: string; user: { name: string } }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [staffId, setStaffId] = useState(staffList[0]?.id ?? "");
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocks, setBlocks] = useState<{ id: string; startsAt: string; endsAt: string; reason?: string | null }[]>([]);

  const loadBlocks = useCallback(async (sid: string) => {
    if (!bizId || !sid) return;
    try { setBlocks(await api.staff.getTimeOffs(bizId, sid)); } catch { setBlocks([]); }
  }, [bizId]);
  useEffect(() => { if (staffId) loadBlocks(staffId); }, [staffId, loadBlocks]);

  async function save() {
    if (!staffId) { toast.error("Choose a provider"); return; }
    const startsAt = new Date(`${date}T${start}`);
    const endsAt = new Date(`${date}T${end}`);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) { toast.error("Enter a valid date and time"); return; }
    if (endsAt <= startsAt) { toast.error("End time must be after the start time"); return; }
    setBusy(true);
    try {
      await api.staff.addTimeOff(bizId, staffId, { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), reason: reason.trim() || undefined });
      toast.success("Time blocked — those hours are now unbookable");
      setReason("");
      loadBlocks(staffId);
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to block time"); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    try {
      await api.staff.deleteTimeOff(bizId, staffId, id);
      setBlocks((p) => p.filter((b) => b.id !== id));
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to remove"); }
  }

  const upcoming = blocks
    .filter((b) => new Date(b.endsAt) >= new Date())
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-semibold text-gray-900">Block time</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          {staffList.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700">
                {staffList.map((s) => <option key={s.id} value={s.id}>{s.user.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <Input placeholder="Lunch, holiday, personal…" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button className="w-full" loading={busy} onClick={save}>Block this time</Button>

          {upcoming.length > 0 && (
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Upcoming blocks</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {upcoming.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {format(new Date(b.startsAt), "EEE, MMM d · HH:mm")}–{format(new Date(b.endsAt), "HH:mm")}
                      </p>
                      {b.reason && <p className="text-[11px] text-gray-400 truncate">{b.reason}</p>}
                    </div>
                    <button onClick={() => remove(b.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0" aria-label="Remove block">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Week view — seven day columns with each day's appointments in time order.
function WeekView({ weekStart, appts, onPrev, onNext, onToday, onSelect }: {
  weekStart: Date; appts: Appointment[];
  onPrev: () => void; onNext: () => void; onToday: () => void;
  onSelect: (a: Appointment) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = new Map<string, Appointment[]>();
  for (const a of appts) {
    const k = format(new Date(a.startsAt), "yyyy-MM-dd");
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(a);
  }
  const weekEnd = addDays(weekStart, 6);
  const rangeLabel = format(weekStart, "MMM d") + " – " + format(weekEnd, isSameMonth(weekStart, weekEnd) ? "d" : "MMM d");
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">{rangeLabel}</p>
        <div className="flex items-center gap-1">
          <button onClick={onToday} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">This week</button>
          <button onClick={onPrev} aria-label="Previous week" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={onNext} aria-label="Next week" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-gray-50">
        {days.map((day) => {
          const k = format(day, "yyyy-MM-dd");
          const list = (byDay.get(k) ?? []).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
          return (
            <div key={k} className="min-h-[180px]">
              <div className={cn("px-2 py-2 text-center border-b border-gray-50", isSameDay(day, new Date()) && "bg-violet-50")}>
                <p className="text-[11px] font-semibold text-gray-400 uppercase">{format(day, "EEE")}</p>
                <p className={cn("text-sm font-bold", isSameDay(day, new Date()) ? "text-violet-700" : "text-gray-700")}>{format(day, "d")}</p>
              </div>
              <div className="p-1.5 space-y-1">
                {list.map((a) => (
                  <button key={a.id} onClick={() => onSelect(a)}
                    className="block w-full text-left rounded-lg border border-gray-100 px-2 py-1.5 hover:bg-gray-50">
                    <span className="flex items-center gap-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[a.status] ?? "bg-gray-300")} />
                      <span className="text-[11px] font-semibold text-gray-700">{format(new Date(a.startsAt), "HH:mm")}</span>
                    </span>
                    <span className="block truncate text-[11px] text-gray-600">{a.client.name}</span>
                  </button>
                ))}
                {list.length === 0 && <p className="px-1 py-2 text-[11px] text-gray-300 text-center">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const user = getUser();
  const isStaff = user?.role === "STAFF";
  const bizId = user?.businessId ?? "";

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [showBlock, setShowBlock] = useState(false);
  const [staffList, setStaffList] = useState<{ id: string; user: { name: string } }[]>([]);

  useEffect(() => {
    if (!bizId) return;
    api.staff.listAll(bizId).then((all) => setStaffList(all.filter((s) => s.active))).catch(() => {});
  }, [bizId]);

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

  // The month grid spans whole weeks, so it ignores the today/week tab and only
  // honours the staff / status / search filters.
  const calendarAppts = useMemo(() => {
    let list = appointments;
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
    return list;
  }, [appointments, staffFilter, statusFilter, search]);

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
        <div className="flex items-center gap-2">
          {!isStaff && (
            <Button variant="outline" size="sm" onClick={() => setShowBlock(true)} className="gap-1.5">
              <CalendarOff className="w-4 h-4" /> Block time
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={load} loading={loading}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </div>

      {showBlock && (
        <BlockTimeModal bizId={bizId} staffList={staffList} onClose={() => setShowBlock(false)} onSaved={load} />
      )}

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
          {(["list","staff","week","calendar"] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setViewMode(v)}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                viewMode === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
              {v === "list" ? "List" : v === "staff" ? "Staff board" : v === "week" ? "Week" : "Month"}
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

      {loading ? <LoadingSpinner /> : viewMode === "calendar" ? (
        <MonthView
          month={calMonth}
          appts={calendarAppts}
          onPrev={() => setCalMonth((m) => subMonths(m, 1))}
          onNext={() => setCalMonth((m) => addMonths(m, 1))}
          onToday={() => setCalMonth(new Date())}
          onSelect={setSelected}
        />
      ) : viewMode === "week" ? (
        <WeekView
          weekStart={weekStart}
          appts={calendarAppts}
          onPrev={() => setWeekStart((w) => subWeeks(w, 1))}
          onNext={() => setWeekStart((w) => addWeeks(w, 1))}
          onToday={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
          onSelect={setSelected}
        />
      ) : filtered.length === 0 ? (
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
