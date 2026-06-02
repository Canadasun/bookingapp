"use client";

import { useEffect, useState, useRef, Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { format, startOfDay, addDays, parseISO } from "date-fns";
import { Check, ChevronLeft, Clock, ChevronRight, X, Calendar, Sun, Sunset, Moon, AlertCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { api, Service, StaffMember, Slot, Business } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { AddToCalendar } from "@/components/AddToCalendar";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { BookingPayment } from "@/components/BookingPayment";
import "react-day-picker/dist/style.css";

type PayInfo = { mode?: "payment" | "setup" | "none"; clientSecret?: string; amountCents?: number; publishableKey?: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
function fmtPrice(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
function groupSlots(slots: Slot[]) {
  const m: Slot[] = [], a: Slot[] = [], e: Slot[] = [];
  for (const s of slots) {
    const h = new Date(s.startsAtLocal).getHours();
    if (h < 12) m.push(s); else if (h < 17) a.push(s); else e.push(s);
  }
  return { morning: m, afternoon: a, evening: e };
}

// ── Step indicator ────────────────────────────────────────────────────────────
const STEPS = ["Services", "Staff", "Date & Time", "Details"];
function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 shrink-0">
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
            i < step ? "bg-violet-600 text-white" :
            i === step ? "bg-violet-600 text-white ring-4 ring-violet-100" :
            "bg-gray-100 text-gray-400",
          )}>
            {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span className={cn("text-sm font-medium shrink-0", i === step ? "text-gray-900" : "text-gray-400")}>{label}</span>
          {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

// ── Cart summary bar ──────────────────────────────────────────────────────────
function CartBar({ services, onClear }: { services: Service[]; onClear: (id: string) => void }) {
  if (services.length === 0) return null;
  const total = services.reduce((s, x) => s + x.priceCents, 0);
  const duration = services.reduce((s, x) => s + x.durationMinutes, 0);
  return (
    <div className="mt-4 bg-violet-50 border border-violet-100 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Selected services</p>
        <div className="flex items-center gap-3 text-sm font-bold text-violet-700">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{fmtDuration(duration)}</span>
          <span>{fmtPrice(total)}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {services.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 bg-white border border-violet-200 rounded-lg px-2.5 py-1 text-xs text-violet-700 font-medium">
            {s.name}
            <button onClick={() => onClear(s.id)} className="ml-0.5 hover:text-red-500 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function BookPageInner({ slug }: { slug: string }) {
  const searchParams  = useSearchParams();
  const rescheduleId  = searchParams.get("reschedule");
  const rescheduleToken = searchParams.get("token") ?? undefined; // HMAC manage token for the public reschedule
  const isEmbed       = searchParams.get("embed") === "1"; // rendered inside the embeddable widget iframe
  const rescheduleLoaded = useRef(false);

  // When embedded, report content height to the host page so embed.js can size
  // the iframe with no inner scrollbar.
  useEffect(() => {
    if (!isEmbed || typeof window === "undefined") return;
    const post = () => window.parent?.postMessage({ type: "bookingapp:height", height: document.body.scrollHeight }, "*");
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [isEmbed]);

  const [step, setStep]               = useState(0);
  const [biz, setBiz]                 = useState<Business | null>(null);
  const [bizId, setBizId]             = useState<string>("");
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [staffList, setStaffList]     = useState<StaffMember[]>([]);
  const [slots, setSlots]             = useState<Slot[]>([]);

  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedStaff, setSelectedStaff]       = useState<StaffMember | "any" | null>(null);
  const [selectedDate, setSelectedDate]         = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot]         = useState<Slot | null>(null);

  const [form, setForm]     = useState({ name: "", email: "", phone: "", notes: "" });
  const [errs, setErrs]     = useState<Partial<typeof form>>({});
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [loadingSlots, setLoadingSlots]     = useState(false);
  const [loadingBiz, setLoadingBiz]         = useState(true);
  const [booking, setBooking]               = useState<{ id: string; startsAt: string; endsAt: string; manageToken?: string } | null>(null);
  const [payInfo, setPayInfo]               = useState<PayInfo | null>(null);
  const [wl, setWl]                         = useState({ name: "", email: "" });
  const [wlSaving, setWlSaving]             = useState(false);
  const [wlDone, setWlDone]                 = useState(false);
  const [revStats, setRevStats]             = useState<{ average: number; count: number; reviews: { id: string; clientName: string; rating: number; comment?: string | null }[] } | null>(null);

  // Load business by slug
  useEffect(() => {
    api.business.getBySlug(slug)
      .then((b) => {
        setBiz(b);
        setBizId(b.id);
        setLoadingBiz(false);
      })
      .catch(() => {
        toast.error("Business not found");
        setLoadingBiz(false);
      });
  }, [slug]);

  // Load services
  useEffect(() => {
    if (!bizId) return;
    api.services.list(bizId).then((s) => setAllServices(s.filter((x) => x.active))).catch(() => {});
  }, [bizId]);

  // Load reviews (social proof)
  useEffect(() => {
    if (!bizId) return;
    api.reviews.list(bizId).then(setRevStats).catch(() => {});
  }, [bizId]);

  // Load staff when services selected
  useEffect(() => {
    if (!bizId || selectedServices.length === 0) { setStaffList([]); return; }
    api.staff.list(bizId).then((all) => {
      const ids = new Set(selectedServices.map((s) => s.id));
      setStaffList(all.filter((st) => st.staffServices.some((ss) => ids.has(ss.serviceId))));
    }).catch(() => {});
  }, [bizId, selectedServices]);

  // Reschedule prefill
  useEffect(() => {
    if (!rescheduleId || rescheduleLoaded.current || allServices.length === 0) return;
    rescheduleLoaded.current = true;
    api.appointments.get(rescheduleId, rescheduleToken).then((apt) => {
      const svc = allServices.find((s) => s.id === apt.service.id);
      if (svc) setSelectedServices([svc]);
      setStep(2);
      toast.success("Select a new date and time");
    }).catch(() => {});
  }, [rescheduleId, rescheduleToken, allServices]);

  function toggleService(svc: Service) {
    setSelectedServices((prev) =>
      prev.find((s) => s.id === svc.id)
        ? prev.filter((s) => s.id !== svc.id)
        : [...prev, svc]
    );
  }

  async function loadSlots(staffId: string, date: Date) {
    setLoadingSlots(true); setSlots([]);
    const serviceId = selectedServices[0]?.id;
    if (!serviceId) return;
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
    const staffId = selectedStaff && selectedStaff !== "any"
      ? selectedStaff.id
      : staffList[0]?.id;
    if (staffId) loadSlots(staffId, date);
  }

  function validate() {
    const e: Partial<typeof form> = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email required";
    if (form.phone && !/^\+?[\d\s\-()+]{7,}$/.test(form.phone)) e.phone = "Invalid phone";
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  async function confirm() {
    if (!validate()) return;
    if (!policyAccepted) { toast.error("Please accept the cancellation policy"); return; }
    if (!selectedSlot || selectedServices.length === 0 || !bizId) return;
    setSubmitting(true);
    try {
      const staffId = selectedStaff && selectedStaff !== "any"
        ? selectedStaff.id
        : staffList[0]?.id;

      if (rescheduleId) {
        const apt = await api.appointments.publicReschedule(rescheduleId, selectedSlot.startsAt, rescheduleToken);
        setBooking(apt); setStep(4);
        return;
      }

      const client = await api.clients.create(bizId, {
        name: form.name, email: form.email, phone: form.phone || undefined, notes: form.notes || undefined,
      });

      // Book first (primary) service; backend handles duration
      const apt = await api.appointments.create(bizId, {
        staffId,
        serviceId: selectedServices[0].id,
        additionalServiceIds: selectedServices.slice(1).map((s) => s.id),
        clientId: client.id,
        startsAt: selectedSlot.startsAt,
        notes: form.notes || undefined,
      });
      setBooking(apt);
      // If the business requires a deposit / card-on-file, collect it before
      // showing the confirmation. Otherwise (default) go straight to success.
      const intent = await api.payments.bookingIntent(apt.id, bizId).catch(() => null);
      if (intent?.required && intent.clientSecret && intent.publishableKey) {
        setPayInfo(intent);
      } else {
        setStep(4);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Booking failed — slot may be taken"); }
    finally { setSubmitting(false); }
  }

  async function joinWaitlist() {
    if (!wl.name.trim() || !/\S+@\S+\.\S+/.test(wl.email) || !bizId) { toast.error("Enter your name and a valid email"); return; }
    setWlSaving(true);
    try {
      await api.waitlist.join(bizId, {
        name: wl.name.trim(),
        email: wl.email.trim(),
        serviceId: selectedServices[0]?.id,
        staffId: selectedStaff && selectedStaff !== "any" ? selectedStaff.id : undefined,
        desiredDate: selectedDate ? selectedDate.toISOString() : undefined,
      });
      setWlDone(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not join the waitlist"); }
    finally { setWlSaving(false); }
  }

  function reset() {
    setStep(0); setSelectedServices([]); setSelectedStaff(null); setSelectedDate(undefined);
    setSelectedSlot(null); setForm({ name: "", email: "", phone: "", notes: "" }); setErrs({});
    setPolicyAccepted(false); setBooking(null); setSlots([]);
  }

  if (loadingBiz) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!biz) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 text-center">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Business not found</h2>
      <p className="text-gray-500 mb-6">The booking page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="text-violet-600 font-medium hover:underline">Go home</Link>
    </div>
  );

  // Payment step: only when the business requires a deposit / card-on-file
  // (booking is already created as PENDING; this collects the deposit/card).
  if (payInfo && booking) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <BookingPayment info={payInfo} onPaid={() => { setPayInfo(null); setStep(4); }} />
      </div>
    </div>
  );

  const today       = startOfDay(new Date());
  const { morning, afternoon, evening } = groupSlots(slots);
  const totalMins   = selectedServices.reduce((s, x) => s + x.durationMinutes, 0);
  const totalCents  = selectedServices.reduce((s, x) => s + x.priceCents, 0);
  const policy      = biz?.cancellationPolicy ?? "Appointments cancelled within 24 hours may be subject to a cancellation fee.";

  return (
    <div className={isEmbed ? "bg-[#F8F9FA]" : "min-h-screen bg-[#F8F9FA]"}>
      {/* Nav — hidden in embed mode (the widget lives on the salon's own site) */}
      {!isEmbed && (
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900">{biz?.name ?? "BookingApp"}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/my/bookings"
              className="text-xs font-medium text-gray-500 hover:text-violet-600 transition-colors border border-gray-200 hover:border-violet-300 px-3 py-1.5 rounded-lg">
              Find my bookings
            </Link>
            <Link href="/my/login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Sign in</Link>
          </div>
        </div>
      </nav>
      )}

      <div className="max-w-2xl mx-auto px-5 py-8">
        {/* Confirmation screen */}
        {step === 4 && booking ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re booked!</h2>
            <p className="text-gray-500 mb-1">Confirmation sent to <span className="font-medium text-gray-800">{form.email}</span></p>
            <p className="text-xs text-gray-400 font-mono mb-6">#{booking.id.slice(-8).toUpperCase()}</p>

            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6 text-sm">
              {selectedServices.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span className="text-gray-600">{s.name}</span>
                  <span className="font-medium text-gray-800">{fmtPrice(s.priceCents)}</span>
                </div>
              ))}
              <hr className="border-gray-200" />
              <div className="flex justify-between font-semibold">
                <span>Total</span><span className="text-violet-700">{fmtPrice(totalCents)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-xs pt-1">
                <span>Duration</span><span>{fmtDuration(totalMins)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-xs">
                <span>When</span>
                <span>{selectedDate && format(selectedDate, "EEE, MMM d")} · {selectedSlot && format(parseISO(selectedSlot.startsAtLocal), "h:mm a")}</span>
              </div>
            </div>

            <div className="flex justify-center mb-4">
              {booking && selectedSlot && (
                <AddToCalendar
                  appointmentId={booking.id}
                  title={`${selectedServices.map(s => s.name).join(" + ")} at ${biz?.name ?? "Salon"}`}
                  startsAt={booking.startsAt}
                  endsAt={booking.endsAt}
                  description={`With ${selectedStaff !== "any" && selectedStaff ? (selectedStaff as { user: { name: string } }).user.name : "any available staff"}`}
                  location={biz?.address}
                />
              )}
            </div>

            <div className="flex gap-3 mb-4">
              <Link href={`/appointments/${booking.id}/manage${booking.manageToken ? `?token=${encodeURIComponent(booking.manageToken)}` : ''}`}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 text-center transition-colors">
                Manage booking
              </Link>
              <button onClick={reset}
                className="flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors">
                Book another
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-2">
              Returning client?{" "}
              <Link href="/my/bookings" className="text-violet-600 font-medium hover:underline">View all your bookings</Link>
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <StepBar step={step} />
            </div>

            {/* ── Step 0: Services ──────────────────────────────────────── */}
            {step === 0 && (
              <div className="px-6 pb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Choose services</h2>
                <p className="text-sm text-gray-400 mb-4">Select one or more services</p>

                {revStats && revStats.count > 0 && (
                  <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={n <= Math.round(revStats.average) ? "w-4 h-4 fill-amber-400 text-amber-400" : "w-4 h-4 text-gray-200"} />
                        ))}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{revStats.average.toFixed(1)}</span>
                      <span className="text-xs text-gray-400">· {revStats.count} review{revStats.count === 1 ? "" : "s"}</span>
                    </div>
                    {revStats.reviews.find((r) => r.comment) && (
                      <p className="text-xs text-gray-500 mt-1.5 italic line-clamp-2">
                        &ldquo;{revStats.reviews.find((r) => r.comment)!.comment}&rdquo; — {revStats.reviews.find((r) => r.comment)!.clientName}
                      </p>
                    )}
                  </div>
                )}

                {allServices.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No services available</p>
                )}

                {/* Group by category */}
                {(() => {
                  const catIds = [...new Set(allServices.map(s => s.category?.id ?? null))];
                  const catNames: Record<string, string> = {};
                  const catColors: Record<string, string> = {};
                  allServices.forEach(s => { if (s.category) { catNames[s.category.id] = s.category.name; catColors[s.category.id] = s.category.color; } });
                  return catIds.map(catId => {
                    const svcs = allServices.filter(s => (s.category?.id ?? null) === catId);
                    return (
                      <div key={catId ?? "__none__"} className="mb-5">
                        {catId && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: catColors[catId] }} />
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{catNames[catId]}</p>
                          </div>
                        )}
                        <div className="space-y-2">
                          {svcs.map((svc) => {
                            const selected = selectedServices.some((s) => s.id === svc.id);
                            return (
                              <button key={svc.id} onClick={() => toggleService(svc)}
                                className={cn(
                                  "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                                  selected ? "border-violet-300 bg-violet-50" : "border-gray-100 hover:border-violet-200 hover:bg-gray-50",
                                )}>
                                <div className="w-2.5 h-10 rounded-full shrink-0" style={{ background: svc.color }} />
                                <div className="flex-1 min-w-0">
                                  <p className={cn("font-semibold text-sm", selected ? "text-violet-700" : "text-gray-900")}>{svc.name}</p>
                                  {svc.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{svc.description}</p>}
                                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />{fmtDuration(svc.durationMinutes)}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={cn("font-bold text-sm", selected ? "text-violet-600" : "text-gray-700")}>{fmtPrice(svc.priceCents)}</p>
                                </div>
                                <div className={cn(
                                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                  selected ? "border-violet-600 bg-violet-600" : "border-gray-300",
                                )}>
                                  {selected && <Check className="w-3 h-3 text-white" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}

                <CartBar services={selectedServices} onClear={(id) => setSelectedServices((p) => p.filter((s) => s.id !== id))} />

                <div className="mt-5">
                  <button
                    onClick={() => setStep(1)}
                    disabled={selectedServices.length === 0}
                    className="w-full py-3.5 rounded-xl bg-violet-600 text-white font-semibold text-sm disabled:opacity-40 hover:bg-violet-700 transition-colors">
                    Continue — {selectedServices.length > 0 ? `${selectedServices.length} service${selectedServices.length > 1 ? "s" : ""} · ${fmtPrice(totalCents)}` : "select services"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 1: Staff ─────────────────────────────────────────── */}
            {step === 1 && (
              <div className="px-6 pb-6">
                <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-violet-600 mb-4 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Choose a provider</h2>
                <p className="text-sm text-gray-400 mb-4">Pick who you&apos;d like to see, or let us choose</p>

                <div className="space-y-2">
                  {/* Any available */}
                  <button
                    onClick={() => { setSelectedStaff("any"); setStep(2); }}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                      selectedStaff === "any" ? "border-violet-300 bg-violet-50" : "border-gray-100 hover:border-violet-200 hover:bg-gray-50",
                    )}>
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-lg">✨</div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-900">Any available</p>
                      <p className="text-xs text-gray-400 mt-0.5">Best availability across all providers</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>

                  {staffList.map((st) => (
                    <button key={st.id}
                      onClick={() => { setSelectedStaff(st); setStep(2); }}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                        selectedStaff !== "any" && (selectedStaff as StaffMember)?.id === st.id
                          ? "border-violet-300 bg-violet-50"
                          : "border-gray-100 hover:border-violet-200 hover:bg-gray-50",
                      )}>
                      <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                        {st.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
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

            {/* ── Step 2: Date + Time ───────────────────────────────────── */}
            {step === 2 && (
              <div className="px-6 pb-6">
                <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-violet-600 mb-4 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Pick a date &amp; time</h2>

                <DayPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={pickDate}
                  disabled={{ before: today, after: addDays(today, biz?.maxAdvanceDays ?? 60) }}
                  className="mx-auto"
                />

                {selectedDate && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      {format(selectedDate, "EEEE, MMMM d")}
                    </p>
                    {loadingSlots ? (
                      <p className="text-sm text-gray-400 text-center py-4">Loading available times…</p>
                    ) : slots.length === 0 ? (
                      <div className="py-4">
                        <div className="text-center mb-4">
                          <p className="text-sm text-gray-500 font-medium">No availability on this date</p>
                          <p className="text-xs text-gray-400 mt-1">Try another date, or join the waitlist and we&apos;ll email you when a spot opens.</p>
                        </div>
                        {wlDone ? (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                            <Check className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                            <p className="text-sm font-medium text-emerald-700">You&apos;re on the waitlist!</p>
                            <p className="text-xs text-emerald-600 mt-0.5">We&apos;ll email you the moment a matching spot frees up.</p>
                          </div>
                        ) : (
                          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Join the waitlist</p>
                            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                              placeholder="Your name" value={wl.name} onChange={(e) => setWl((p) => ({ ...p, name: e.target.value }))} />
                            <input className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-violet-400"
                              placeholder="you@example.com" type="email" value={wl.email} onChange={(e) => setWl((p) => ({ ...p, email: e.target.value }))} />
                            <button type="button" onClick={joinWaitlist} disabled={wlSaving}
                              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors">
                              {wlSaving ? "Joining…" : "Notify me when a spot opens"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {[{ label: "Morning", icon: Sun, slots: morning },
                          { label: "Afternoon", icon: Sunset, slots: afternoon },
                          { label: "Evening", icon: Moon, slots: evening }
                        ].filter((g) => g.slots.length > 0).map(({ label, icon: Icon, slots: s }) => (
                          <div key={label}>
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                              <Icon className="w-3.5 h-3.5" />{label}
                            </p>
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                              {s.map((sl) => (
                                <button key={sl.startsAt}
                                  onClick={() => { setSelectedSlot(sl); setStep(3); }}
                                  className={cn(
                                    "py-2.5 rounded-xl border text-xs font-semibold transition-all",
                                    selectedSlot?.startsAt === sl.startsAt
                                      ? "bg-violet-600 text-white border-violet-600"
                                      : "border-gray-200 text-gray-700 hover:border-violet-400 hover:bg-violet-50",
                                  )}>
                                  {format(parseISO(sl.startsAtLocal), "h:mm")}
                                  <span className="text-[10px] block">{format(parseISO(sl.startsAtLocal), "a")}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Details + Policy ──────────────────────────────── */}
            {step === 3 && (
              <div className="px-6 pb-6">
                <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-violet-600 mb-4 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Your details</h2>

                {/* Booking summary */}
                <div className="bg-violet-50 rounded-xl p-4 mb-5 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-violet-800">
                        {selectedServices.map((s) => s.name).join(" + ")}
                      </p>
                      <p className="text-violet-600 mt-0.5">
                        {selectedDate && format(selectedDate, "EEE, MMM d")}
                        {selectedSlot && ` at ${format(parseISO(selectedSlot.startsAtLocal), "h:mm a")}`}
                        {selectedStaff !== "any" && selectedStaff && ` · ${(selectedStaff as StaffMember).user.name}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-violet-700">{fmtPrice(totalCents)}</p>
                      <p className="text-violet-500 text-xs">{fmtDuration(totalMins)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {([
                    { k: "name",  label: "Full name *",  type: "text",  ph: "Jane Smith" },
                    { k: "email", label: "Email *",       type: "email", ph: "jane@example.com" },
                    { k: "phone", label: "Phone",         type: "tel",   ph: "+1 555 000 0000" },
                    { k: "notes", label: "Notes (optional)", type: "text", ph: "Anything we should know?" },
                  ] as const).map(({ k, label, type, ph }) => (
                    <div key={k}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                      <input
                        type={type}
                        placeholder={ph}
                        value={form[k]}
                        onChange={(e) => { setForm((p) => ({ ...p, [k]: e.target.value })); setErrs((p) => ({ ...p, [k]: "" })); }}
                        className={cn(
                          "w-full px-3 py-2.5 text-sm border rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-shadow",
                          errs[k] ? "border-red-400" : "border-gray-200",
                        )}
                      />
                      {errs[k] && <p className="text-xs text-red-500 mt-1">{errs[k]}</p>}
                    </div>
                  ))}

                  {/* Cancellation policy */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-2">
                      <AlertCircle className="w-3.5 h-3.5" /> Cancellation policy
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">{policy}</p>
                    <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={policyAccepted}
                        onChange={(e) => setPolicyAccepted(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-violet-600 shrink-0"
                      />
                      <span className="text-xs text-amber-800 font-medium">
                        I have read and agree to the cancellation policy
                      </span>
                    </label>
                  </div>

                  <button
                    onClick={confirm}
                    disabled={submitting || !policyAccepted}
                    className="w-full py-4 rounded-xl bg-violet-600 text-white font-semibold text-sm disabled:opacity-40 hover:bg-violet-700 transition-colors">
                    {submitting ? "Booking…" : `Confirm booking · ${fmtPrice(totalCents)}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by <span className="text-violet-500 font-medium">BookingApp</span>
        </p>
      </div>
    </div>
  );
}

export default function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
      <BookPageInner slug={slug} />
    </Suspense>
  );
}
