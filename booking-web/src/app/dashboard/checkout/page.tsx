"use client";

import { useEffect, useState, useCallback } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { DayPicker } from "react-day-picker";
import { parseISO } from "date-fns";
import { Search, Check, Clock, User, ChevronRight, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, Service, StaffMember, Client, Slot, Business } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import "react-day-picker/dist/style.css";

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  return h > 0 ? `${h}h` : `${m}m`;
}
function fmtPrice(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

type Step = "client" | "services" | "staff" | "datetime" | "confirm";

export default function CheckoutPage() {
  const [step, setStep]                   = useState<Step>("client");
  const [biz, setBiz]                     = useState<Business | null>(null);
  const [allServices, setAllServices]     = useState<Service[]>([]);
  const [staffList, setStaffList]         = useState<StaffMember[]>([]);
  const [slots, setSlots]                 = useState<Slot[]>([]);

  const [clientSearch, setClientSearch]   = useState("");
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [searching, setSearching]         = useState(false);
  const [newClientMode, setNewClientMode] = useState(false);
  const [newClient, setNewClient]         = useState({ name: "", email: "", phone: "" });

  const [selectedClient, setSelectedClient]   = useState<Client | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedStaff, setSelectedStaff]     = useState<StaffMember | "any" | null>(null);
  const [selectedDate, setSelectedDate]       = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot]       = useState<Slot | null>(null);

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [booked, setBooked]             = useState<{ id: string } | null>(null);

  const user = getUser();
  const bizId = user?.businessId ?? "";

  useEffect(() => {
    if (!bizId) return;
    api.business.get(bizId).then(setBiz).catch(() => {});
    api.services.listAll(bizId).then((s) => setAllServices(s.filter((x) => x.active))).catch(() => {});
  }, [bizId]);

  useEffect(() => {
    if (!bizId || selectedServices.length === 0) { setStaffList([]); return; }
    api.staff.listAll(bizId).then((all) => {
      const ids = new Set(selectedServices.map((s) => s.id));
      setStaffList(all.filter((st) => st.active && st.staffServices.some((ss) => ids.has(ss.serviceId))));
    }).catch(() => {});
  }, [bizId, selectedServices]);

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
    const staffId = selectedStaff && selectedStaff !== "any" ? selectedStaff.id : staffList[0]?.id;
    const serviceId = selectedServices[0]?.id;
    if (!staffId || !serviceId) { setLoadingSlots(false); return; }
    try {
      const d = format(date, "yyyy-MM-dd");
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setSlots(await api.availability.getSlots({ staffId, serviceId, startDate: d, endDate: d, timezone: tz }));
    } catch { toast.error("Failed to load times"); }
    finally { setLoadingSlots(false); }
  }

  function pickDate(date?: Date) {
    if (!date) return;
    setSelectedDate(date); setSelectedSlot(null);
    loadSlots(date);
  }

  async function createOrGetClient(): Promise<Client | null> {
    if (!bizId) return null;
    if (selectedClient) return selectedClient;
    if (!newClient.name.trim() || !newClient.email.trim()) {
      toast.error("Name and email are required"); return null;
    }
    try {
      return await api.clients.create(bizId, {
        name: newClient.name, email: newClient.email, phone: newClient.phone || undefined,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create client"); return null;
    }
  }

  async function confirm() {
    if (!bizId || !selectedSlot || selectedServices.length === 0) return;
    setSubmitting(true);
    try {
      const client = await createOrGetClient();
      if (!client) return;
      const staffId = selectedStaff && selectedStaff !== "any" ? selectedStaff.id : staffList[0]?.id;
      const apt = await api.appointments.createManual(bizId, {
        staffId, serviceId: selectedServices[0].id,
        clientId: client.id, startsAt: selectedSlot.startsAt,
      });
      setBooked(apt);
      toast.success("Appointment booked & confirmed!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    } finally { setSubmitting(false); }
  }

  function reset() {
    setStep("client"); setSelectedClient(null); setSelectedServices([]);
    setSelectedStaff(null); setSelectedDate(undefined); setSelectedSlot(null);
    setSlots([]); setBooked(null); setClientSearch(""); setClientResults([]);
    setNewClientMode(false); setNewClient({ name: "", email: "", phone: "" });
  }

  const today = startOfDay(new Date());
  const totalMins  = selectedServices.reduce((s, x) => s + x.durationMinutes, 0);
  const totalCents = selectedServices.reduce((s, x) => s + x.priceCents, 0);

  // ── Success screen ──────────────────────────────────────────────────────────
  if (booked) return (
    <div className="max-w-lg mx-auto text-center">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking confirmed!</h2>
        <p className="text-gray-500 mb-1">
          {selectedClient?.name ?? newClient.name} — {selectedServices.map(s => s.name).join(" + ")}
        </p>
        <p className="text-xs text-gray-400 font-mono mb-6">#{booked.id.slice(-8).toUpperCase()}</p>
        <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-1.5 mb-6">
          {selectedDate && <p className="text-gray-700"><span className="text-gray-400">Date: </span>{format(selectedDate, "EEE, MMM d, yyyy")}</p>}
          {selectedSlot && <p className="text-gray-700"><span className="text-gray-400">Time: </span>{format(parseISO(selectedSlot.startsAtLocal), "h:mm a")}</p>}
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
        <h2 className="text-xl font-bold text-gray-900">Walk-in checkout</h2>
        <p className="text-sm text-gray-400 mt-0.5">Book an appointment for a client at the counter</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-7 overflow-x-auto pb-1">
        {(["client","services","staff","datetime","confirm"] as Step[]).map((s, i) => {
          const labels: Record<Step, string> = { client: "Client", services: "Services", staff: "Staff", datetime: "Date & Time", confirm: "Confirm" };
          const done = ["client","services","staff","datetime","confirm"].indexOf(step) > i;
          const cur  = step === s;
          return (
            <div key={s} className="flex items-center gap-1 shrink-0">
              <div className={cn("w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors",
                done ? "bg-violet-600 text-white" : cur ? "bg-violet-600 text-white ring-4 ring-violet-100" : "bg-gray-100 text-gray-400"
              )}>
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={cn("text-xs font-medium", cur ? "text-gray-900" : "text-gray-400")}>{labels[s]}</span>
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
                  {[
                    { k: "name",  label: "Full name *",   type: "text" },
                    { k: "email", label: "Email *",        type: "email" },
                    { k: "phone", label: "Phone (optional)", type: "tel" },
                  ].map(({ k, label, type }) => (
                    <div key={k}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                      <Input type={type}
                        value={newClient[k as keyof typeof newClient]}
                        onChange={(e) => setNewClient((p) => ({ ...p, [k]: e.target.value }))} />
                    </div>
                  ))}
                  <Button className="w-full"
                    disabled={!newClient.name.trim() || !newClient.email.trim()}
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
              Choose services for <span className="text-violet-700">{selectedClient?.name ?? newClient.name}</span>
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

            <Button className="w-full mt-5" disabled={selectedServices.length === 0} onClick={() => setStep("staff")}>
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
            <div className="space-y-2">
              <button onClick={() => { setSelectedStaff("any"); setStep("datetime"); }}
                className={cn("w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
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
                    <p className="font-semibold text-sm text-gray-900">{st.user.name}</p>
                    {st.bio && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{st.bio}</p>}
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
            <button onClick={() => setStep("staff")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-violet-600 mb-4 transition-colors">
              ← Back
            </button>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Pick a date &amp; time</h3>
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={pickDate}
              disabled={{ before: today, after: addDays(today, biz?.maxAdvanceDays ?? 60) }}
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
                      <button key={sl.startsAt}
                        onClick={() => { setSelectedSlot(sl); setStep("confirm"); }}
                        className={cn("py-2.5 rounded-xl border text-xs font-semibold transition-all",
                          selectedSlot?.startsAt === sl.startsAt
                            ? "bg-violet-600 text-white border-violet-600"
                            : "border-gray-200 text-gray-700 hover:border-violet-400 hover:bg-violet-50")}>
                        {format(parseISO(sl.startsAtLocal), "h:mm")}
                        <span className="text-[10px] block">{format(parseISO(sl.startsAtLocal), "a")}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
                { label: "Client", value: selectedClient?.name ?? newClient.name, icon: User },
                { label: "Services", value: selectedServices.map(s => s.name).join(", "), icon: Check },
                { label: "Duration", value: fmtDuration(totalMins), icon: Clock },
                { label: "Date", value: selectedDate ? format(selectedDate, "EEE, MMM d, yyyy") : "—", icon: Check },
                { label: "Time", value: selectedSlot ? format(parseISO(selectedSlot.startsAtLocal), "h:mm a") : "—", icon: Check },
                { label: "Total", value: fmtPrice(totalCents), icon: Check },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>

            <Button className="w-full" loading={submitting} onClick={confirm}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm booking
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
