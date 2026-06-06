"use client";

import { useEffect, useState, useCallback } from "react";
import { format, addMinutes, startOfDay, isBefore, isAfter } from "date-fns";
import { DayPicker } from "react-day-picker";
import { parseISO } from "date-fns";
import { Search, Check, Clock, User, ChevronRight, CheckCircle2, Plus, Repeat } from "lucide-react";
import { toast } from "sonner";
import { api, Service, StaffMember, Client, Slot, Business } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import "react-day-picker/style.css";

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  return h > 0 ? `${h}h` : `${m}m`;
}
function fmtPrice(cents: number, currency: "CAD" | "USD" = "CAD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

type Step = "client" | "services" | "staff" | "datetime" | "confirm";
type BookingSlot = Slot & { staffId?: string; staffName?: string };

export default function CheckoutPage() {
  const [step, setStep]                   = useState<Step>("client");
  const [biz, setBiz]                     = useState<Business | null>(null);
  const [allServices, setAllServices]     = useState<Service[]>([]);
  const [allStaffList, setAllStaffList]   = useState<StaffMember[]>([]);
  const [staffList, setStaffList]         = useState<StaffMember[]>([]);
  const [slots, setSlots]                 = useState<BookingSlot[]>([]);

  const [clientSearch, setClientSearch]   = useState("");
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [searching, setSearching]         = useState(false);
  const [newClientMode, setNewClientMode] = useState(false);
  const [newClient, setNewClient]         = useState({ firstName: "", lastName: "", email: "", phone: "" });

  const [selectedClient, setSelectedClient]   = useState<Client | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedStaff, setSelectedStaff]     = useState<StaffMember | "any" | null>(null);
  const [selectedDate, setSelectedDate]       = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot]       = useState<BookingSlot | null>(null);
  const [customDate, setCustomDate]           = useState("");
  const [customTime, setCustomTime]           = useState("");
  const [customStaffId, setCustomStaffId]     = useState("");
  const [overrideCalendar, setOverrideCalendar] = useState(false);
  const [recurring, setRecurring] = useState<{ enabled: boolean; frequency: "WEEKLY" | "BIWEEKLY" | "THREE_WEEKS" | "EIGHT_WEEKS" | "MONTHLY"; count: number }>({ enabled: false, frequency: "WEEKLY", count: 4 });

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [booked, setBooked]             = useState<{ id: string } | null>(null);

  const user = getUser();
  const bizId = user?.businessId ?? "";

  useEffect(() => {
    if (!bizId) return;
    api.business.get(bizId).then(setBiz).catch(() => {});
    api.services.listAll(bizId).then((s) => setAllServices(s.filter((x) => x.active))).catch(() => {});
    api.staff.listAll(bizId).then((all) => setAllStaffList(all.filter((st) => st.active))).catch(() => {});
  }, [bizId]);

  // "Book again" deep-link from the Clients page (?client=<id>): pre-select that
  // client and skip straight to choosing services — no duplicate contact created.
  useEffect(() => {
    if (!bizId || typeof window === "undefined") return;
    const clientId = new URLSearchParams(window.location.search).get("client");
    if (!clientId) return;
    api.clients.get(bizId, clientId)
      .then((c) => { setSelectedClient(c); setStep("services"); })
      .catch(() => {});
  }, [bizId]);

  useEffect(() => {
    if (!bizId || selectedServices.length === 0) { setStaffList([]); return; }
    api.staff.listAll(bizId).then((all) => {
      const ids = selectedServices.map((s) => s.id);
      // A provider with no explicit service assignments offers everything
      // (sole-proprietor model) — otherwise match the assigned services.
      setStaffList(all.filter((st) => st.active && (st.staffServices.length === 0 || ids.every((id) => st.staffServices.some((ss) => ss.serviceId === id)))));
    }).catch(() => {});
  }, [bizId, selectedServices]);

  useEffect(() => {
    if (selectedStaff !== "any") {
      setCustomStaffId("");
      return;
    }
    if (!customStaffId && allStaffList[0]) setCustomStaffId(allStaffList[0].id);
  }, [selectedStaff, allStaffList, customStaffId]);

  const searchClients = useCallback(async (q: string) => {
    if (!bizId || !q.trim()) { setClientResults([]); return; }
    setSearching(true);
    try { const res = await api.clients.list(bizId, q); setClientResults(res.data); }
    catch { setClientResults([]); }
    finally { setSearching(false); }
  }, [bizId]);

  useEffect(() => {
    const t = setTimeout(() => searchClients(clientSearch), 300);
    return () => clearTimeout(t);
  }, [clientSearch, searchClients]);

  async function loadSlots(date: Date) {
    if (!bizId) return;
    setLoadingSlots(true); setSlots([]);
    const serviceId = selectedServices[0]?.id;
    const targets = selectedStaff && selectedStaff !== "any" ? [selectedStaff] : staffList;
    if (targets.length === 0 || !serviceId) { setLoadingSlots(false); return; }
    try {
      const d = format(date, "yyyy-MM-dd");
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const rows = await Promise.all(targets.map(async (staff) => {
        const staffSlots = await api.availability.getSlots({ staffId: staff.id, serviceId, startDate: d, endDate: d, timezone: tz, enforceNotice: false });
        return staffSlots.map((slot) => ({ ...slot, staffId: staff.id, staffName: staff.user.name }));
      }));
      setSlots(rows.flat().sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
    } catch { toast.error("Failed to load times"); }
    finally { setLoadingSlots(false); }
  }

  function pickDate(date?: Date) {
    if (!date) return;
    setSelectedDate(date); setSelectedSlot(null);
    setCustomDate(format(date, "yyyy-MM-dd"));
    loadSlots(date);
  }

  async function createOrGetClient(): Promise<Client | null> {
    if (!bizId) return null;
    if (selectedClient) return selectedClient;
    if (!newClientValid) {
      toast.error("Enter a valid first name, last name, email and phone"); return null;
    }
    const name = `${newClient.firstName.trim()} ${newClient.lastName.trim()}`.trim();
    try {
      return await api.clients.create(bizId, {
        name, email: newClient.email.trim(), phone: newClient.phone.trim() || undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create client"); return null;
    }
  }

  function customStartsAtValue() {
    return customDate && customTime ? `${customDate}T${customTime}` : "";
  }

  function resolvedCustomStaff() {
    if (selectedStaff && selectedStaff !== "any") return selectedStaff;
    return allStaffList.find((st) => st.id === customStaffId) ?? allStaffList[0] ?? null;
  }

  async function confirm() {
    if (!bizId || selectedServices.length === 0) return;
    const customStartsAt = customStartsAtValue();
    const customDate = customStartsAt ? new Date(customStartsAt) : null;
    if (customStartsAt && Number.isNaN(customDate?.getTime())) {
      toast.error("Enter a valid custom date and time");
      return;
    }
    const startsAt = customDate ? customDate.toISOString() : selectedSlot?.startsAt;
    if (!startsAt) {
      toast.error("Choose an available time or enter a custom owner time");
      return;
    }
    setSubmitting(true);
    try {
      const client = await createOrGetClient();
      if (!client) return;
      const staffId = customStartsAt
        ? resolvedCustomStaff()?.id
        : selectedStaff && selectedStaff !== "any"
          ? selectedStaff.id
          : selectedSlot?.staffId;
      if (!staffId) { toast.error("Choose a provider before booking"); return; }
      const common = {
        staffId, serviceId: selectedServices[0].id,
        additionalServiceIds: selectedServices.slice(1).map((s) => s.id),
        clientId: client.id, startsAt,
        allowOverride: overrideCalendar || !!customStartsAt,
      };
      if (recurring.enabled) {
        const res = await api.appointments.createRecurring(bizId, { ...common, frequency: recurring.frequency, count: recurring.count });
        setBooked(res.created[0] ?? null);
        toast.success(
          `Booked ${res.created.length} of ${recurring.count} appointments${res.skipped.length ? ` — ${res.skipped.length} skipped (conflicts)` : ""}`,
        );
      } else {
        const apt = await api.appointments.createManual(bizId, common);
        setBooked(apt);
        toast.success("Appointment booked & confirmed!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    } finally { setSubmitting(false); }
  }

  function reset() {
    setStep("client"); setSelectedClient(null); setSelectedServices([]);
    setSelectedStaff(null); setSelectedDate(undefined); setSelectedSlot(null);
    setCustomDate(""); setCustomTime(""); setCustomStaffId(""); setOverrideCalendar(false);
    setRecurring({ enabled: false, frequency: "WEEKLY", count: 4 });
    setSlots([]); setBooked(null); setClientSearch(""); setClientResults([]);
    setNewClientMode(false); setNewClient({ firstName: "", lastName: "", email: "", phone: "" });
  }

  // New-client field validation — block "Continue" on bad email / phone / missing names.
  const ncEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email.trim());
  const ncPhoneDigits = newClient.phone.replace(/\D/g, "");
  const ncPhoneOk = ncPhoneDigits.length >= 10 && ncPhoneDigits.length <= 15;
  const ncFirstOk = newClient.firstName.trim().length >= 1;
  const ncLastOk = newClient.lastName.trim().length >= 1;
  const newClientValid = ncFirstOk && ncLastOk && ncEmailOk && ncPhoneOk;
  const newClientName = `${newClient.firstName.trim()} ${newClient.lastName.trim()}`.trim();

  const today = startOfDay(new Date());
  const advanceLimit = addMinutes(new Date(), biz?.maxAdvanceMinutes ?? ((biz?.maxAdvanceDays ?? 60) * 1440));
  const totalMins  = selectedServices.reduce((s, x) => s + x.durationMinutes, 0);
  const totalCents = selectedServices.reduce((s, x) => s + x.priceCents, 0);
  // Sole-proprietor first: the provider step + per-person names only appear once
  // the business has an added non-owner provider. The owner-provider still exists
  // behind the scenes so bookings/calendar sync have a staffId.
  const multiProvider = allStaffList.some((st) => st.user.role !== "OWNER");
  const salonName = biz?.name ?? "—";
  const providerText = (name?: string) => (multiProvider ? (name ? `${name} (${salonName})` : salonName) : salonName);
  const showStaffStep = multiProvider;
  const STEPS: Step[] = showStaffStep
    ? ["client", "services", "staff", "datetime", "confirm"]
    : ["client", "services", "datetime", "confirm"];
  const customStartsAt = customStartsAtValue();
  const customStaff = resolvedCustomStaff();

  // ── Success screen ──────────────────────────────────────────────────────────
  if (booked) return (
    <div className="max-w-lg mx-auto text-center">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking confirmed!</h2>
        <p className="text-gray-500 mb-1">
          {selectedClient?.name ?? newClientName} — {selectedServices.map(s => s.name).join(" + ")}
        </p>
        <p className="text-xs text-gray-400 font-mono mb-6">#{booked.id.slice(-8).toUpperCase()}</p>
        <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-1.5 mb-6">
          {(selectedDate || customStartsAt) && <p className="text-gray-700"><span className="text-gray-400">Date: </span>{format(customStartsAt ? new Date(customStartsAt) : selectedDate!, "EEE, MMM d, yyyy")}</p>}
          {(selectedSlot || customStartsAt) && <p className="text-gray-700"><span className="text-gray-400">Time: </span>{customStartsAt ? format(new Date(customStartsAt), "h:mm a") : format(parseISO(selectedSlot!.startsAtLocal), "h:mm a")}</p>}
          <p className="text-gray-700"><span className="text-gray-400">Provider: </span>{providerText(customStartsAt ? customStaff?.user.name : selectedSlot?.staffName)}</p>
          <p className="text-gray-700"><span className="text-gray-400">Duration: </span>{fmtDuration(totalMins)}</p>
          <p className="font-semibold text-violet-700"><span className="text-gray-400">Total: </span>{fmtPrice(totalCents)}</p>
        </div>
        <Button onClick={reset} className="w-full">New booking</Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">New booking</h2>
        <p className="text-sm text-gray-400 mt-0.5">Book an appointment for a client from your services</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-7 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const labels: Record<Step, string> = { client: "Client", services: "Services", staff: "Staff", datetime: "Date & Time", confirm: "Confirm" };
          const done = STEPS.indexOf(step) > i;
          const cur  = step === s;
          return (
            <div key={s} className="flex items-center gap-1 shrink-0">
              {/* Completed steps are clickable to jump back and edit. */}
              <button type="button" disabled={!done} onClick={() => done && setStep(s)}
                title={done ? `Back to ${labels[s]}` : undefined}
                className={cn("flex items-center gap-1", done && "cursor-pointer hover:opacity-75 transition-opacity")}>
                <div className={cn("w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors",
                  done ? "bg-violet-600 text-white" : cur ? "bg-violet-600 text-white ring-4 ring-violet-100" : "bg-gray-100 text-gray-400"
                )}>
                  {done ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={cn("text-xs font-medium", cur ? "text-gray-900" : done ? "text-violet-700" : "text-gray-400")}>{labels[s]}</span>
              </button>
              {i < 4 && <ChevronRight className="w-3 h-3 text-gray-200 mx-1" />}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* ── Client ─────────────────────────────────────────────────── */}
        {step === "client" && (
          <div className="p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Who is this booking for?</h3>

            {!newClientMode ? (
              <>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Search by name, email or phone…"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                {searching && <p className="text-sm text-gray-400 text-center py-4">Searching…</p>}

                {clientResults.length > 0 && (
                  <div className="space-y-1 mb-3 max-h-60 overflow-y-auto">
                    {clientResults.map((c) => (
                      <button key={c.id} onClick={() => { setSelectedClient(c); setStep("services"); }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50 text-left transition-colors">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs shrink-0">
                          {c.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                          <p className="text-xs text-gray-500 truncate">{c.email}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {clientSearch && clientResults.length === 0 && !searching && (
                  <p className="text-sm text-gray-400 text-center py-3">No clients found</p>
                )}

                <button
                  onClick={() => setNewClientMode(true)}
                  className="flex items-center gap-2 text-sm text-violet-600 font-medium hover:underline mt-2">
                  <Plus className="w-4 h-4" /> Add new client
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setNewClientMode(false)}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-violet-600 mb-4 transition-colors">
                  ← Back to search
                </button>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">First name *</label>
                      <Input type="text" placeholder="Jane"
                        value={newClient.firstName}
                        onChange={(e) => setNewClient((p) => ({ ...p, firstName: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name *</label>
                      <Input type="text" placeholder="Doe"
                        value={newClient.lastName}
                        onChange={(e) => setNewClient((p) => ({ ...p, lastName: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
                    <Input type="email" placeholder="jane@example.com"
                      className={newClient.email.trim() && !ncEmailOk ? "border-red-300 focus-visible:ring-red-200" : ""}
                      value={newClient.email}
                      onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))} />
                    {newClient.email.trim() && !ncEmailOk && (
                      <p className="mt-1 text-xs text-red-600">Enter a valid email address.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 select-none pointer-events-none z-10">+1</span>
                      <Input type="tel" placeholder="555 123 4567"
                        className={newClient.phone.trim() && !ncPhoneOk ? "pl-9 border-red-300 focus-visible:ring-red-200" : "pl-9"}
                        value={newClient.phone}
                        onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))} />
                    </div>
                    {newClient.phone.trim() && !ncPhoneOk && (
                      <p className="mt-1 text-xs text-red-600">Enter a valid phone number (10–15 digits).</p>
                    )}
                  </div>
                  <Button className="w-full"
                    disabled={!newClientValid}
                    onClick={() => setStep("services")}>
                    Continue
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Services ───────────────────────────────────────────────── */}
        {step === "services" && (
          <div className="p-6">
            <button onClick={() => setStep("client")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-violet-600 mb-4 transition-colors">
              ← Back
            </button>
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              Choose services for <span className="text-violet-700">{selectedClient?.name ?? newClientName}</span>
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {allServices.map((svc) => {
                const sel = selectedServices.some((s) => s.id === svc.id);
                return (
                  <button key={svc.id} onClick={() =>
                    setSelectedServices((p) => sel ? p.filter((s) => s.id !== svc.id) : [...p, svc])}
                    className={cn("w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                      sel ? "border-violet-300 bg-violet-50" : "border-gray-100 hover:border-violet-200 hover:bg-gray-50")}>
                    <div className="w-2.5 h-10 rounded-full shrink-0" style={{ background: svc.color }} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-semibold text-sm", sel ? "text-violet-700" : "text-gray-900")}>{svc.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDuration(svc.durationMinutes)}</p>
                    </div>
                    <div className="text-right shrink-0 mr-2">
                      <p className={cn("font-bold text-sm", sel ? "text-violet-600" : "text-gray-700")}>{fmtPrice(svc.priceCents)}</p>
                    </div>
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                      sel ? "border-violet-600 bg-violet-600" : "border-gray-300")}>
                      {sel && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedServices.length > 0 && (
              <div className="mt-4 bg-violet-50 border border-violet-100 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
                  <Clock className="w-3.5 h-3.5" />{fmtDuration(totalMins)}
                </div>
                <span className="text-sm font-bold text-violet-700">{fmtPrice(totalCents)}</span>
              </div>
            )}

            <Button className="w-full mt-5" disabled={selectedServices.length === 0} onClick={() => { if (showStaffStep) { setStep("staff"); } else { setSelectedStaff(allStaffList[0] ?? "any"); setStep("datetime"); } }}>
              Continue — {selectedServices.length} service{selectedServices.length !== 1 ? "s" : ""}
            </Button>
          </div>
        )}

        {/* ── Staff ──────────────────────────────────────────────────── */}
        {step === "staff" && (
          <div className="p-6">
            <button onClick={() => setStep("services")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-violet-600 mb-4 transition-colors">
              ← Back
            </button>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Choose a provider</h3>
            {staffList.length === 0 && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No provider is assigned to every selected service yet. You can still use <span className="font-semibold">Custom owner time</span> on the next step with any active provider.
              </div>
            )}
            <div className="space-y-2">
              <button onClick={() => { setSelectedStaff("any"); setStep("datetime"); }}
                disabled={staffList.length === 0 && allStaffList.length === 0}
                className={cn("w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                  staffList.length === 0 && allStaffList.length === 0 && "opacity-50 cursor-not-allowed",
                  selectedStaff === "any" ? "border-violet-300 bg-violet-50" : "border-gray-100 hover:border-violet-200 hover:bg-gray-50")}>
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg shrink-0">✨</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">Any available</p>
                  <p className="text-xs text-gray-400 mt-0.5">Best availability</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>
              {staffList.map((st) => (
                <button key={st.id} onClick={() => { setSelectedStaff(st); setStep("datetime"); }}
                  className={cn("w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                    (selectedStaff as StaffMember)?.id === st.id ? "border-violet-300 bg-violet-50" : "border-gray-100 hover:border-violet-200 hover:bg-gray-50")}>
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                    {st.user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900">{st.user.name} <span className="font-normal text-gray-400">({salonName})</span></p>
                    {st.bio && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{st.bio}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              ))}
              {staffList.length === 0 && allStaffList.map((st) => (
                <button key={st.id} onClick={() => { setSelectedStaff(st); setStep("datetime"); }}
                  className={cn("w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                    (selectedStaff as StaffMember)?.id === st.id ? "border-violet-300 bg-violet-50" : "border-gray-100 hover:border-violet-200 hover:bg-gray-50")}>
                  <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                    {st.user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900">{st.user.name} <span className="font-normal text-gray-400">({salonName})</span></p>
                    <p className="text-xs text-amber-600 mt-0.5">Owner override provider</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Date & Time ────────────────────────────────────────────── */}
        {step === "datetime" && (
          <div className="p-6">
            <button onClick={() => setStep(showStaffStep ? "staff" : "services")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-violet-600 mb-4 transition-colors">
              ← Back
            </button>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Pick a date &amp; time</h3>
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={pickDate}
              disabled={(date) => isBefore(date, today) || isAfter(startOfDay(date), startOfDay(advanceLimit))}
              className="mx-auto"
            />
            {selectedDate && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">{format(selectedDate, "EEEE, MMMM d")}</p>
                {loadingSlots ? (
                  <p className="text-sm text-gray-400 text-center py-4">Loading times…</p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No availability on this date</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {slots.map((sl) => (
                      <button key={`${sl.staffId ?? "staff"}-${sl.startsAt}`}
                        onClick={() => { setSelectedSlot(sl); setCustomDate(""); setCustomTime(""); setOverrideCalendar(false); setStep("confirm"); }}
                        className={cn("py-2.5 rounded-xl border text-xs font-semibold transition-all",
                          selectedSlot?.startsAt === sl.startsAt
                            ? "bg-violet-600 text-white border-violet-600"
                            : "border-gray-200 text-gray-700 hover:border-violet-400 hover:bg-violet-50")}>
                        {format(parseISO(sl.startsAtLocal), "h:mm a")}
                        {selectedStaff === "any" && sl.staffName && <span className="text-[10px] block truncate px-1 opacity-70">{sl.staffName}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Custom owner time</p>
              <p className="mt-1 text-xs text-amber-700">Book any date and time directly. This overrides availability and double-book conflicts, then syncs like other confirmed bookings.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {selectedStaff === "any" && (
                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-xs font-semibold text-amber-900">Provider</label>
                    <select
                      value={customStaffId}
                      onChange={(e) => setCustomStaffId(e.target.value)}
                      className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      {allStaffList.map((st) => <option key={st.id} value={st.id}>{st.user.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-amber-900">Date</label>
                  <Input
                    type="date"
                    min={format(today, "yyyy-MM-dd")}
                    max={format(advanceLimit, "yyyy-MM-dd")}
                    value={customDate}
                    onChange={(e) => { setCustomDate(e.target.value); setSelectedSlot(null); setOverrideCalendar(!!e.target.value && !!customTime); }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-amber-900">Time</label>
                  <Input
                    type="time"
                    step={300}
                    value={customTime}
                    onChange={(e) => { setCustomTime(e.target.value); setSelectedSlot(null); setOverrideCalendar(!!customDate && !!e.target.value); }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-amber-900">Quick times</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {["09:00", "12:00", "15:00", "18:00"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { setCustomTime(t); setSelectedSlot(null); setOverrideCalendar(!!customDate); }}
                        className={cn(
                          "rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors",
                          customTime === t ? "border-violet-500 bg-violet-600 text-white" : "border-amber-200 bg-white text-amber-900 hover:border-violet-300",
                        )}
                      >
                        {format(parseISO(`2000-01-01T${t}:00`), "h:mm a")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {customStartsAt && (
                <Button type="button" variant="secondary" className="mt-3 w-full sm:w-auto" onClick={() => setStep("confirm")}>
                  Use {format(new Date(customStartsAt), "MMM d")} at {format(new Date(customStartsAt), "h:mm a")}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Confirm ────────────────────────────────────────────────── */}
        {step === "confirm" && (
          <div className="p-6">
            <button onClick={() => setStep("datetime")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-violet-600 mb-4 transition-colors">
              ← Back
            </button>
            <h3 className="text-base font-semibold text-gray-900 mb-5">Confirm booking</h3>

            <div className="space-y-3 text-sm mb-6">
              {[
                { label: "Client", value: selectedClient?.name ?? newClientName, icon: User },
                { label: "Services", value: selectedServices.map(s => s.name).join(", "), icon: Check },
                { label: "Duration", value: fmtDuration(totalMins), icon: Clock },
                { label: "Provider", value: providerText(customStartsAt ? customStaff?.user.name : selectedStaff !== "any" && selectedStaff ? selectedStaff.user.name : selectedSlot?.staffName), icon: Check },
                { label: "Date", value: customStartsAt ? format(new Date(customStartsAt), "EEE, MMM d, yyyy") : selectedDate ? format(selectedDate, "EEE, MMM d, yyyy") : "—", icon: Check },
                { label: "Time", value: customStartsAt ? format(new Date(customStartsAt), "h:mm a") : selectedSlot ? format(parseISO(selectedSlot.startsAtLocal), "h:mm a") : "—", icon: Check },
                { label: "Calendar", value: customStartsAt || overrideCalendar ? "Owner override" : "Available slot", icon: Check },
                { label: "Total", value: fmtPrice(totalCents), icon: Check },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>

            {/* Recurring series — repeat this booking on a schedule */}
            <div className="mb-5 rounded-xl border border-gray-100 p-3">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Repeat className="w-4 h-4 text-violet-600" /> Repeat this appointment
                </span>
                <input type="checkbox" className="h-4 w-4 accent-violet-600"
                  checked={recurring.enabled}
                  onChange={(e) => setRecurring((p) => ({ ...p, enabled: e.target.checked }))} />
              </label>
              {recurring.enabled && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
                    <select value={recurring.frequency}
                      onChange={(e) => setRecurring((p) => ({ ...p, frequency: e.target.value as typeof p.frequency }))}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700">
                      <option value="WEEKLY">Weekly</option>
                      <option value="BIWEEKLY">Every 2 weeks</option>
                      <option value="THREE_WEEKS">Every 3 weeks</option>
                      <option value="EIGHT_WEEKS">Every 8 weeks</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Occurrences</label>
                    <select value={recurring.count}
                      onChange={(e) => setRecurring((p) => ({ ...p, count: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? "time" : "times"}</option>)}
                    </select>
                  </div>
                  <p className="col-span-2 text-xs text-gray-400">Creates {recurring.count} confirmed bookings; any that conflict are skipped.</p>
                </div>
              )}
            </div>

            <Button className="w-full" loading={submitting} onClick={confirm}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> {recurring.enabled ? `Book ${recurring.count} appointments` : "Confirm booking"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
