"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  format, isToday, isThisWeek,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, addMonths, subMonths, addDays, addWeeks, subWeeks, isSameDay,
} from "date-fns";
import { RefreshCw, Search, X, CheckCircle, XCircle, AlertCircle, CheckSquare, DollarSign, ChevronLeft, ChevronRight, CalendarOff, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { api, Appointment, AvailabilityRule, Service } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { formatPrice, cn, normalizePhoneE164, formatPhoneInput } from "@/lib/utils";

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
    clientEmail: apt.client.email ?? "",
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
              {format(new Date(apt.startsAt), "h:mm a")} - {format(new Date(apt.endsAt), "h:mm a")}
            </p>
          </div>

          {/* Details */}
          {[
            { label: "Service",  value: `${apt.service.name} (${apt.service.durationMinutes} min)` },
            { label: "Price",    value: formatPrice(apt.totalPriceCents || apt.service.priceCents) },
            { label: "Staff",    value: apt.staff.user.name },
            ...(apt.location ? [{ label: "Location", value: apt.location.name }] : []),
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
            <a href={`/dashboard/receipt/${apt.id}`} target="_blank" rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <FileText className="w-4 h-4" /> View receipt
            </a>
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
function MonthView({ month, appts, onPrev, onNext, onToday, onSelect, onReschedule }: {
  month: Date; appts: Appointment[];
  onPrev: () => void; onNext: () => void; onToday: () => void;
  onSelect: (a: Appointment) => void;
  onReschedule: (id: string, dayKey: string) => void;
}) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
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
            <div key={k}
              onDragOver={(e) => { e.preventDefault(); setDragOverKey(k); }}
              onDragLeave={() => setDragOverKey((cur) => cur === k ? null : cur)}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setDragOverKey(null); if (id) onReschedule(id, k); }}
              className={cn("min-h-[96px] border-b border-r border-gray-50 p-1.5 transition-colors", !inMonth && "bg-gray-50/40", dragOverKey === k && "bg-violet-50 ring-1 ring-inset ring-violet-300")}>
              <div className={cn("text-xs mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full",
                isToday(day) ? "bg-violet-600 text-white font-bold" : inMonth ? "text-gray-700" : "text-gray-300")}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((a) => (
                  <button key={a.id} onClick={() => onSelect(a)}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", a.id); e.dataTransfer.effectAllowed = "move"; }}
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-gray-100 cursor-grab active:cursor-grabbing">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[a.status] ?? "bg-gray-300")} />
                    <span className="truncate text-[11px] text-gray-700">{format(new Date(a.startsAt), "h:mm a")} {a.client.name}</span>
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

// Quick "New appointment" modal — lets staff/owners book for a client using
// just name + phone/email, then picks service, provider, date and time.
function NewAppointmentModal({ bizId, staffList, onClose, onSaved }: {
  bizId: string;
  staffList: { id: string; user: { name: string }; locationId?: string | null }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const nextHour = format(new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000), "HH:mm");

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState(staffList[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(nextHour);
  const [notes, setNotes] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationFilter, setLocationFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const filteredStaff = locationFilter
    ? staffList.filter((s) => s.locationId === locationFilter)
    : staffList;

  useEffect(() => {
    if (!bizId) return;
    Promise.all([
      api.services.listAll(bizId),
      api.locations.list(bizId),
    ]).then(([svcList, locList]) => {
      setServices(svcList);
      if (svcList.length > 0) setServiceId(svcList[0].id);
      setLocations(locList.filter((l) => l.active));
    }).catch(() => {});
  }, [bizId]);

  // When location filter changes, reset staffId to first matching staff
  useEffect(() => {
    const first = filteredStaff[0]?.id ?? "";
    setStaffId(first);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationFilter]);

  async function submit() {
    const trimName = clientName.trim();
    if (trimName.length < 2) { toast.error("Client name must be at least 2 characters"); return; }
    if (!phone.trim() && !email.trim()) { toast.error("Provide at least a phone number or email"); return; }
    if (!serviceId) { toast.error("Select a service"); return; }
    if (!staffId) { toast.error("Select a staff member"); return; }
    const startsAt = new Date(`${date}T${time}`);
    if (Number.isNaN(startsAt.getTime())) { toast.error("Enter a valid date and time"); return; }

    setBusy(true);
    try {
      const clientPayload: { name: string; phone?: string; email?: string } = { name: trimName };
      if (phone.trim()) clientPayload.phone = normalizePhoneE164(phone.trim());
      if (email.trim()) clientPayload.email = email.trim();

      const clientRes = await api.clients.create(bizId, clientPayload);
      await api.appointments.createManual(bizId, {
        staffId,
        serviceId,
        clientId: clientRes.id,
        startsAt: startsAt.toISOString(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success("Appointment created");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create appointment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-base font-semibold text-gray-900">New appointment</p>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client name <span className="text-red-500">*</span></label>
            <Input placeholder="Jane Smith" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <Input type="tel" placeholder="(555) 123-4567" value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input type="email" placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <p className="text-xs text-gray-400 -mt-1">At least one of phone or email is required.</p>

          {/* Service */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service <span className="text-red-500">*</span></label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
              {services.length === 0 && <option value="">Loading…</option>}
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Location filter (only shown when business has multiple locations) */}
          {locations.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
                <option value="">All locations</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}

          {/* Staff */}
          {staffList.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff member <span className="text-red-500">*</span></label>
              <select value={staffId} onChange={(e) => setStaffId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300">
                {filteredStaff.length === 0
                  ? <option value="">No staff at this location</option>
                  : filteredStaff.map((s) => <option key={s.id} value={s.id}>{s.user.name}</option>)
                }
              </select>
            </div>
          )}

          {/* Date & time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <Input placeholder="Any notes for this appointment…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <Button className="w-full mt-1" loading={busy} onClick={submit}>Book appointment</Button>
        </div>
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
                        {format(new Date(b.startsAt), "EEE, MMM d · h:mm a")}–{format(new Date(b.endsAt), "h:mm a")}
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
// Time-grid WeekView: shows 7am–9pm with business hours highlighted and non-business hours greyed.
const GRID_START = 7;   // 7 am
const GRID_END   = 21;  // 9 pm
const ROW_H      = 56;  // px per hour

function timeToGridOffset(isoString: string): number {
  const d = new Date(isoString);
  return (d.getHours() + d.getMinutes() / 60 - GRID_START) * ROW_H;
}
function durationToHeight(startsAt: string, endsAt: string): number {
  const mins = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000;
  return Math.max((mins / 60) * ROW_H, 20);
}
function timeStrToFrac(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

function WeekView({ weekStart, appts, allStaff, onPrev, onNext, onToday, onSelect, onReschedule }: {
  weekStart: Date; appts: Appointment[];
  allStaff: { availabilityRules?: AvailabilityRule[] }[];
  onPrev: () => void; onNext: () => void; onToday: () => void;
  onSelect: (a: Appointment) => void;
  onReschedule: (id: string, dayKey: string) => void;
}) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [nowOffset, setNowOffset] = useState<number | null>(null);

  // Update "now" indicator every minute
  useEffect(() => {
    function update() {
      const now = new Date();
      const frac = now.getHours() + now.getMinutes() / 60;
      if (frac >= GRID_START && frac <= GRID_END) {
        setNowOffset((frac - GRID_START) * ROW_H);
      } else {
        setNowOffset(null);
      }
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = new Map<string, Appointment[]>();
  for (const a of appts) {
    const k = format(new Date(a.startsAt), "yyyy-MM-dd");
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(a);
  }
  const weekEnd = addDays(weekStart, 6);
  const rangeLabel = format(weekStart, "MMM d") + " – " + format(weekEnd, isSameMonth(weekStart, weekEnd) ? "d" : "MMM d");

  // Aggregate business open hours per day-of-week (0=Sun–6=Sat) from all staff rules
  const bizHours = useMemo(() => {
    const map = new Map<number, { open: number; close: number }>();
    for (const s of allStaff) {
      for (const r of s.availabilityRules ?? []) {
        const open  = timeStrToFrac(r.startTime);
        const close = timeStrToFrac(r.endTime);
        const cur = map.get(r.dayOfWeek);
        map.set(r.dayOfWeek, { open: Math.min(cur?.open ?? open, open), close: Math.max(cur?.close ?? close, close) });
      }
    }
    return map;
  }, [allStaff]);

  const hours = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);
  const gridH = (GRID_END - GRID_START) * ROW_H;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">{rangeLabel}</p>
        <div className="flex items-center gap-1">
          <button onClick={onToday} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">This week</button>
          <button onClick={onPrev} aria-label="Previous week" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={onNext} aria-label="Next week" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Day headers */}
      <div className="flex border-b border-gray-100">
        <div className="w-12 shrink-0" />
        {days.map((day) => (
          <div key={day.toISOString()} className={cn(
            "flex-1 text-center py-2 border-l border-gray-50",
            isSameDay(day, new Date()) && "bg-violet-50",
          )}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{format(day, "EEE")}</p>
            <p className={cn("text-sm font-bold", isSameDay(day, new Date()) ? "text-violet-700" : "text-gray-700")}>{format(day, "d")}</p>
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: "600px" }}>
        <div className="flex" style={{ height: `${gridH}px`, minWidth: 0 }}>
          {/* Hour labels */}
          <div className="w-12 shrink-0 relative">
            {hours.map((h) => (
              <div key={h} style={{ position: "absolute", top: `${(h - GRID_START) * ROW_H - 8}px`, right: "4px" }}
                className="text-[10px] text-gray-400 text-right w-10">
                {format(new Date(2000, 0, 1, h), "ha")}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const k = format(day, "yyyy-MM-dd");
            const dow = day.getDay();
            const biz = bizHours.get(dow);
            const isOpen = !!biz;
            const openOffset  = isOpen ? Math.max(0, (biz!.open  - GRID_START) * ROW_H) : 0;
            const closeOffset = isOpen ? Math.min(gridH, (biz!.close - GRID_START) * ROW_H) : 0;
            const list = (byDay.get(k) ?? []).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
            const isCurrentDay = isSameDay(day, new Date());

            return (
              <div key={k} className="flex-1 relative border-l border-gray-100 min-w-0"
                onDragOver={(e) => { e.preventDefault(); setDragOverKey(k); }}
                onDragLeave={() => setDragOverKey((cur) => cur === k ? null : cur)}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setDragOverKey(null); if (id) onReschedule(id, k); }}>

                {/* Hour grid lines */}
                {hours.map((h) => (
                  <div key={h} style={{ top: `${(h - GRID_START) * ROW_H}px`, height: `${ROW_H}px` }}
                    className="absolute inset-x-0 border-t border-gray-50" />
                ))}

                {/* Non-business hours overlay: full column grey if closed, or top/bottom strips */}
                {bizHours.size > 0 && (
                  <>
                    {!isOpen ? (
                      // Full day closed
                      <div className="absolute inset-0 bg-gray-50/80" />
                    ) : (
                      <>
                        {/* Before open */}
                        {openOffset > 0 && (
                          <div className="absolute inset-x-0 top-0 bg-gray-50/80" style={{ height: `${openOffset}px` }} />
                        )}
                        {/* After close */}
                        {closeOffset < gridH && (
                          <div className="absolute inset-x-0 bottom-0 bg-gray-50/80" style={{ height: `${gridH - closeOffset}px` }} />
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Today column tint (below greys) */}
                {isCurrentDay && <div className="absolute inset-0 bg-violet-500/[0.03] pointer-events-none" />}

                {/* Drag-over highlight */}
                {dragOverKey === k && <div className="absolute inset-0 bg-violet-100/60 ring-1 ring-inset ring-violet-300 pointer-events-none" />}

                {/* Current time indicator */}
                {isCurrentDay && nowOffset !== null && (
                  <div className="absolute inset-x-0 z-20 flex items-center pointer-events-none" style={{ top: `${nowOffset}px` }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-px bg-red-400" />
                  </div>
                )}

                {/* Appointments */}
                {list.map((a) => {
                  const top = timeToGridOffset(a.startsAt);
                  const height = durationToHeight(a.startsAt, a.endsAt);
                  if (top + height < 0 || top > gridH) return null;
                  return (
                    <button key={a.id}
                      style={{ top: `${Math.max(0, top)}px`, height: `${height}px`, left: "2px", right: "2px", position: "absolute" }}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", a.id); e.dataTransfer.effectAllowed = "move"; }}
                      onClick={() => onSelect(a)}
                      className={cn(
                        "z-10 rounded-md text-left overflow-hidden border text-white cursor-grab active:cursor-grabbing hover:brightness-95 transition-all",
                        STATUS_DOT[a.status] === "bg-emerald-500" ? "bg-emerald-500 border-emerald-600"
                          : STATUS_DOT[a.status] === "bg-red-500"     ? "bg-red-500 border-red-600"
                          : STATUS_DOT[a.status] === "bg-gray-400"    ? "bg-gray-400 border-gray-500"
                          : "bg-violet-500 border-violet-600",
                      )}>
                      <div className="px-1.5 pt-1 leading-tight">
                        <p className="text-[10px] font-bold truncate">{format(new Date(a.startsAt), "h:mm a")}</p>
                        <p className="text-[10px] truncate opacity-90">{a.client.name}</p>
                        {height >= 48 && <p className="text-[10px] truncate opacity-75">{a.service?.name}</p>}
                      </div>
                    </button>
                  );
                })}

                {/* Closed label */}
                {!isOpen && bizHours.size > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest rotate-[-90deg]">Closed</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
  const [showSearch, setShowSearch] = useState(false);
  const [staffFilter, setStaffFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [showBlock, setShowBlock] = useState(false);
  const [showNewApt, setShowNewApt] = useState(false);
  const [staffList, setStaffList] = useState<{ id: string; user: { name: string }; locationId?: string | null }[]>([]);
  const [allStaffFull, setAllStaffFull] = useState<{ availabilityRules?: AvailabilityRule[] }[]>([]);

  useEffect(() => {
    if (!bizId) return;
    api.staff.listAll(bizId).then((all) => {
      const active = all.filter((s) => s.active);
      setStaffList(active);
      setAllStaffFull(active);
    }).catch(() => {});
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
          clientPhone: extra.clientPhone ? normalizePhoneE164(extra.clientPhone) : extra.clientPhone,
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
        (a.client.email ?? "").toLowerCase().includes(q) ||
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
        (a.client.email ?? "").toLowerCase().includes(q) ||
        (a.client.phone ?? "").includes(q)
      );
    }
    return list;
  }, [appointments, staffFilter, statusFilter, search]);

  // Drag-and-drop reschedule: move an appointment to another day, keeping its time.
  async function rescheduleToDay(appointmentId: string, dayKey: string) {
    if (!bizId) return;
    const apt = appointments.find((a) => a.id === appointmentId);
    if (!apt) return;
    const orig = new Date(apt.startsAt);
    const [y, m, d] = dayKey.split("-").map(Number);
    const next = new Date(orig);
    next.setFullYear(y, m - 1, d);
    if (next.getTime() === orig.getTime()) return; // dropped on the same day
    try {
      await api.appointments.reschedule(bizId, appointmentId, next.toISOString());
      toast.success(`Moved ${apt.client.name} to ${format(next, "EEE, MMM d")}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reschedule — that time may be unavailable");
    }
  }

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
          <Button size="sm" onClick={() => setShowNewApt(true)} className="gap-1.5">
            + New appointment
          </Button>
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

      {showNewApt && (
        <NewAppointmentModal bizId={bizId} staffList={staffList} onClose={() => setShowNewApt(false)} onSaved={load} />
      )}
      {showBlock && (
        <BlockTimeModal bizId={bizId} staffList={staffList} onClose={() => setShowBlock(false)} onSaved={load} />
      )}

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={tab} onChange={(e) => setTab(e.target.value as Tab)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 font-medium">
          <option value="all">All appointments</option>
          <option value="week">This week</option>
          <option value="today">Today</option>
        </select>

        <div className="flex items-center gap-1">
          <button onClick={() => { setShowSearch(s => !s); if (showSearch) setSearch(""); }}
            className={cn("p-2 rounded-xl border transition-colors", showSearch ? "bg-violet-50 border-violet-200 text-violet-600" : "border-gray-200 text-gray-400 hover:text-gray-600")}>
            <Search className="w-4 h-4" />
          </button>
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search client…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-48" autoFocus />
            </div>
          )}
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
          onReschedule={rescheduleToDay}
        />
      ) : viewMode === "week" ? (
        <WeekView
          weekStart={weekStart}
          appts={calendarAppts}
          allStaff={allStaffFull}
          onPrev={() => setWeekStart((w) => subWeeks(w, 1))}
          onNext={() => setWeekStart((w) => addWeeks(w, 1))}
          onToday={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
          onSelect={setSelected}
          onReschedule={rescheduleToDay}
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
                    {format(new Date(apt.startsAt), "EEE, MMM d · h:mm a")} - {format(new Date(apt.endsAt), "h:mm a")}
                  </p>
                </div>
                <div className="text-xs text-gray-400 shrink-0">{formatPrice(apt.totalPriceCents || apt.service.priceCents)}</div>
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
