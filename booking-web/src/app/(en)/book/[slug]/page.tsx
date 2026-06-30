"use client";

import { useEffect, useState, useRef, Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { DayPicker } from "react-day-picker";
import { format, startOfDay, addMinutes, parseISO, isBefore, isAfter } from "date-fns";
import { frCA } from "date-fns/locale";
import { Check, ChevronLeft, Clock, ChevronRight, X, Calendar, Sun, Sunset, Moon, AlertCircle, Star, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, Service, StaffMember, Slot, Business } from "@/lib/api";
import { cn, formatPhoneInput, normalizePhoneE164 } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
const AddToCalendar = dynamic(() => import("@/components/AddToCalendar").then(m => m.AddToCalendar), { ssr: false });
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { BookingPayment } from "@/components/BookingPayment";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { getUser, type SessionUser } from "@/lib/auth";
import { consumeFragmentToken } from "@/lib/fragment-token";
import "react-day-picker/style.css";

type PayInfo = { mode?: "payment" | "setup" | "none"; amountCents?: number; currency?: "CAD" | "USD"; applicationId?: string; locationId?: string; saveCard?: boolean };
type BookingSlot = Slot & { staffId?: string; staffName?: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
function fmtPrice(cents: number, currency: "CAD" | "USD" = "CAD", locale: "en" | "fr" = "en") {
  return new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency }).format(cents / 100);
}
function normalizeHexColor(value: unknown, fallback = "#7C3AED") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  const short = /^#([0-9A-Fa-f]{3})$/.exec(trimmed);
  if (short) return `#${short[1].split("").map((c) => c + c).join("")}`;
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : fallback;
}
function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}
function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
function contrastRatio(a: string, b: string) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}
function bestTextOn(hex: string) {
  return contrastRatio(hex, "#FFFFFF") >= contrastRatio(hex, "#1F2937") ? "#FFFFFF" : "#1F2937";
}
function groupSlots<T extends Slot>(slots: T[]) {
  const m: T[] = [], a: T[] = [], e: T[] = [];
  for (const s of slots) {
    // Slice the HH from the offset-aware local string (e.g. "2024-01-15T09:00:00-05:00")
    // instead of using new Date().getHours() which returns the browser's local-timezone
    // hour and breaks grouping for clients in a different timezone than the business.
    // It also avoids Safari's inconsistent handling of timezone-offset date strings.
    const h = parseInt(s.startsAtLocal.slice(11, 13), 10);
    if (h < 12) m.push(s); else if (h < 17) a.push(s); else e.push(s);
  }
  return { morning: m, afternoon: a, evening: e };
}

// ── Step indicator ────────────────────────────────────────────────────────────
// Labels are dynamic: sole-proprietors never see a "Provider" step.
function StepBar({ labels, current, isFrench = false }: { labels: string[]; current: number; isFrench?: boolean }) {
  const STEPS = labels;
  return (
    <ol aria-label={isFrench ? "Étapes de réservation" : "Booking steps"} className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 list-none pl-0">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2 shrink-0" aria-current={i === current ? "step" : undefined}>
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
            i < current ? "bk-step-active" :
            i === current ? "bk-step-active bk-step-current" :
            "bg-gray-100 text-gray-400",
          )}>
            {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span className={cn("text-sm font-medium shrink-0", i === current ? "text-gray-900" : "text-gray-400")}>{label}</span>
          {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
        </li>
      ))}
    </ol>
  );
}

// ── Cart summary bar ──────────────────────────────────────────────────────────
function CartBar({ services, onClear, locale = "en" }: { services: Service[]; onClear: (id: string) => void; locale?: "en" | "fr" }) {
  if (services.length === 0) return null;
  const isFrench = locale === "fr";
  const total = services.reduce((s, x) => s + x.priceCents, 0);
  const duration = services.reduce((s, x) => s + x.durationMinutes, 0);
  return (
    <div className="mt-4 bk-brand-soft border bk-brand-border-soft rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold bk-brand-text uppercase tracking-wide">{isFrench ? "Services sélectionnés" : "Selected services"}</p>
        <div className="flex items-center gap-3 text-sm font-bold bk-brand-text">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{fmtDuration(duration)}</span>
          <span>{fmtPrice(total, "CAD", locale)}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {services.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 bg-white border bk-brand-border-soft rounded-lg px-2.5 py-1 text-xs bk-brand-text font-medium">
            {s.name}
            <button onClick={() => onClear(s.id)} aria-label={`${isFrench ? "Retirer" : "Remove"} ${s.name}`} className="ml-0.5 hover:text-red-500 transition-colors">
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export function BookPageInner({ slug, lookup = "slug" }: { slug: string; lookup?: "slug" | "id" }) {
  const searchParams  = useSearchParams();
  const locale: "en" | "fr" = searchParams.get("lang") === "fr" ? "fr" : "en";
  const isFrench = locale === "fr";
  const dateLocale = isFrench ? { locale: frCA } : undefined;
  const languageHref = (() => {
    const query = new URLSearchParams(searchParams.toString());
    if (isFrench) query.delete("lang"); else query.set("lang", "fr");
    const suffix = query.toString();
    return suffix ? `?${suffix}` : "?";
  })();
  const rescheduleId  = searchParams.get("reschedule");
  const [rescheduleToken, setRescheduleToken] = useState<string | undefined>();
  const [fragmentReady, setFragmentReady] = useState(false);
  const isEmbed       = searchParams.get("embed") === "1"; // rendered inside the embeddable widget iframe
  const isBusinessIdRef = lookup === "id" || searchParams.get("ref") === "business-id";
  const rescheduleLoaded = useRef(false);

  useEffect(() => {
    setRescheduleToken(rescheduleId ? consumeFragmentToken(`appointment-manage:${rescheduleId}`) : undefined);
    setFragmentReady(true);
  }, [rescheduleId]);

  // When embedded, report content height to the host page so embed.js can size
  // the iframe with no inner scrollbar.
  useEffect(() => {
    if (!isEmbed || typeof window === "undefined") return;
    const post = () => window.parent?.postMessage({ type: "bookingapp:height", height: document.documentElement.scrollHeight }, "*");
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [isEmbed]);

  const [step, setStep]               = useState(0);
  const [biz, setBiz]                 = useState<Business | null>(null);
  const [bizId, setBizId]             = useState<string>("");
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [activeStaff, setActiveStaff] = useState<StaffMember[]>([]);
  const [staffList, setStaffList]     = useState<StaffMember[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [slots, setSlots]             = useState<BookingSlot[]>([]);

  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedStaff, setSelectedStaff]       = useState<StaffMember | "any" | null>(null);
  const [selectedDate, setSelectedDate]         = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot]         = useState<BookingSlot | null>(null);

  const [form, setForm]     = useState({ name: "", email: "", phone: "", notes: "" });
  // Where to meet the client, collected only when the primary service is an
  // at-customer (mobile) service.
  const [customerAddress, setCustomerAddress] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [promoCode, setPromoCode]           = useState("");
  const [promoResult, setPromoResult]       = useState<{ id: string; discountCents: number; label: string } | null>(null);
  const [promoChecking, setPromoChecking]   = useState(false);
  const [intake, setIntake] = useState<Record<string, string>>({}); // questionId → answer
  const [errs, setErrs]     = useState<Record<string, string>>({});
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [loadingSlots, setLoadingSlots]     = useState(false);
  const [loadingBiz, setLoadingBiz]         = useState(true);
  const [booking, setBooking]               = useState<{ id: string; startsAt: string; endsAt: string; manageToken?: string; locationMode?: string | null; meetingUrl?: string | null; customerAddress?: string | null; location?: { id: string; name: string; address?: string | null } | null } | null>(null);
  const [clientMatched, setClientMatched]   = useState(false);
  const [payInfo, setPayInfo]               = useState<PayInfo | null>(null);
  const [cardSaved, setCardSaved]           = useState(false); // setup intent completed — card on file
  const [wl, setWl]                         = useState({ name: "", email: "" });
  const [wlSaving, setWlSaving]             = useState(false);
  const [wlDone, setWlDone]                 = useState(false);
  const [slotTaken, setSlotTaken]           = useState(false); // someone grabbed the slot first → offer waitlist
  const [navUser, setNavUser]               = useState<SessionUser | null>(null); // logged-in viewer → show a way back
  useEffect(() => { setNavUser(getUser()); }, []);
  const homeHref = navUser
    ? (navUser.role === "ADMIN" ? "/admin" : navUser.role === "CLIENT" ? "/my/dashboard" : "/dashboard")
    : null;
  const [revStats, setRevStats]             = useState<{ average: number; count: number; reviews: { id: string; clientName: string; rating: number; comment?: string | null }[] } | null>(null);

  // Load business by slug
  useEffect(() => {
    const loadBusiness = isBusinessIdRef ? api.business.getPublicById(slug) : api.business.getBySlug(slug);
    loadBusiness
      .then((b) => {
        setBiz(b);
        setBizId(b.id);
        if (b.locations?.length === 1) setSelectedLocationId(b.locations[0].id);
        setLoadingBiz(false);
      })
      .catch(() => {
        toast.error(isFrench ? "Entreprise introuvable" : "Business not found");
        setLoadingBiz(false);
      });
  }, [slug, isBusinessIdRef, isFrench]);

  // Load catalogue in parallel once bizId is known.
  // Three separate requests but issued simultaneously so they don't waterfall.
  useEffect(() => {
    if (!bizId) { setActiveStaff([]); return; }
    Promise.all([
      api.services.list(bizId).catch(() => [] as Service[]),
      api.reviews.list(bizId).catch(() => null),
      api.staff.list(bizId).catch(() => [] as StaffMember[]),
    ]).then(([services, reviews, staff]) => {
      setAllServices(services.filter((x) => x.active));
      setRevStats(reviews);
      setActiveStaff(staff);
    });
  }, [bizId]);

  // Service-filtered providers for the picker: a provider with no explicit service
  // assignments offers everything (sole-proprietor) — otherwise match assignments.
  useEffect(() => {
    if (selectedServices.length === 0) { setStaffList([]); return; }
    setStaffList(activeStaff.filter((st) =>
      (st.staffServices.length === 0 || selectedServices.every((svc) => st.staffServices.some((ss) => ss.serviceId === svc.id))) &&
      (!selectedLocationId || st.locationId === selectedLocationId),
    ));
  }, [activeStaff, selectedServices, selectedLocationId]);

  // Reschedule prefill
  useEffect(() => {
    if (!fragmentReady || !rescheduleId || !rescheduleToken || rescheduleLoaded.current || allServices.length === 0) return;
    rescheduleLoaded.current = true;
    api.appointments.get(rescheduleId, rescheduleToken).then((apt) => {
      const svc = allServices.find((s) => s.id === apt.service.id);
      if (svc) setSelectedServices([svc]);
      if (apt.location?.id) setSelectedLocationId(apt.location.id);
      setForm((p) => ({ ...p, name: apt.client.name, email: apt.client.email ?? "", phone: apt.client.phone ?? "" }));
      setWl({ name: apt.client.name, email: apt.client.email ?? "" });
      setStep(2);
      toast.success(isFrench ? "Choisissez une nouvelle date et une nouvelle heure" : "Select a new date and time");
    }).catch(() => {});
  }, [fragmentReady, rescheduleId, rescheduleToken, allServices, isFrench]);

  function toggleService(svc: Service) {
    setSelectedServices((prev) =>
      prev.find((s) => s.id === svc.id)
        ? prev.filter((s) => s.id !== svc.id)
        : [...prev, svc]
    );
  }

  async function loadSlots(date: Date) {
    setLoadingSlots(true); setSlots([]);
    const serviceId = selectedServices[0]?.id;
    if (!serviceId) return;
    try {
      const d = format(date, "yyyy-MM-dd");
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const additionalServiceIds = selectedServices.slice(1).map((svc) => svc.id);
      const staffTargets = selectedStaff && selectedStaff !== "any" ? [selectedStaff] : staffList;
      const rows = await Promise.all(staffTargets.map(async (staff) => {
        const staffSlots = await api.availability.getSlots({ staffId: staff.id, serviceId, additionalServiceIds, startDate: d, endDate: d, timezone: tz });
        return staffSlots.map((slot) => ({ ...slot, staffId: staff.id, staffName: staff.user.name }));
      }));
      setSlots(rows.flat().sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
    } catch { toast.error(isFrench ? "Échec du chargement des disponibilités" : "Failed to load times"); }
    finally { setLoadingSlots(false); }
  }

  function pickDate(date?: Date) {
    if (!date) return;
    setSelectedDate(date); setSelectedSlot(null);
    if (selectedStaff || staffList.length > 0) loadSlots(date);
  }

  function focusBookingField(fieldKey: string) {
    const id = fieldKey.startsWith("intake_")
      ? `intake-${fieldKey.replace("intake_", "")}`
      : fieldKey === "policyAccepted"
        ? "policy-accepted"
        : `field-${fieldKey}`;

    window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el instanceof HTMLButtonElement) {
        el.focus({ preventScroll: true });
      }
    }, 0);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = isFrench ? "Obligatoire" : "Required";
    if (!form.email.trim() && !form.phone.trim()) e.email = isFrench ? "Entrez une adresse courriel ou un numéro de téléphone" : "Enter an email address or phone number";
    else if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = isFrench ? "Entrez un courriel valide ou laissez le champ vide" : "Enter a valid email or leave it blank";
    if (form.phone && !/^\+?[\d\s\-()+]{7,}$/.test(form.phone)) e.phone = isFrench ? "Téléphone invalide" : "Invalid phone";
    if ((selectedServices[0]?.locationMode ?? "IN_PERSON") === "CUSTOMER" && !customerAddress.trim()) {
      e.customerAddress = isFrench ? "Entrez l’adresse où nous devons nous rendre" : "Enter the address we should come to";
    }
    for (const q of biz?.intakeQuestions ?? []) {
      if (q.required && !(intake[q.id] ?? "").trim()) e[`intake_${q.id}`] = isFrench ? "Obligatoire" : "Required";
    }
    setErrs(e);
    const firstError = Object.keys(e)[0];
    if (firstError) focusBookingField(firstError);
    return !firstError;
  }

  async function confirm() {
    if (!validate()) return;
    if (!policyAccepted) {
      toast.error(isFrench ? "Veuillez accepter la politique d’annulation" : "Please accept the cancellation policy");
      focusBookingField("policyAccepted");
      return;
    }
    if (!selectedSlot || selectedServices.length === 0 || !bizId) return;
    setSubmitting(true);
    try {
      const staffId = selectedStaff && selectedStaff !== "any"
        ? selectedStaff.id
        : selectedSlot.staffId;
      if (!staffId) { toast.error(isFrench ? "Choisissez une heure disponible" : "Choose an available time"); return; }

      if (rescheduleId) {
        const apt = await api.appointments.publicReschedule(rescheduleId, selectedSlot.startsAt, rescheduleToken);
        setBooking(apt); setStep(4);
        return;
      }

      const client = await api.clients.create(bizId, {
        name: form.name, email: form.email || undefined, phone: form.phone ? normalizePhoneE164(form.phone) : undefined, notes: form.notes || undefined,
      });
      if (!client.clientToken) throw new Error(isFrench ? "Impossible de démarrer une session de réservation sécurisée" : "Could not start a secure booking session");
      setClientMatched(false);

      // Collect answers to the business intake questions (by label, for display).
      const intakeAnswers = (biz?.intakeQuestions ?? [])
        .map((q) => ({ label: q.label, answer: (intake[q.id] ?? "").trim() }))
        .filter((a) => a.answer);

      // Book first (primary) service; backend handles duration
      const apt = await api.appointments.create(bizId, {
        staffId,
        serviceId: selectedServices[0].id,
        additionalServiceIds: selectedServices.slice(1).map((s) => s.id),
        clientToken: client.clientToken,
        startsAt: selectedSlot.startsAt,
        notes: form.notes || undefined,
        intakeAnswers: intakeAnswers.length ? intakeAnswers : undefined,
        referralSource: referralSource || undefined,
        promoCodeId: promoResult?.id || undefined,
        locationId: selectedLocationId || undefined,
        customerAddress: (selectedServices[0]?.locationMode ?? "IN_PERSON") === "CUSTOMER"
          ? customerAddress.trim() : undefined,
        locale,
      });
      setBooking(apt);
      // If the business requires a deposit / card-on-file, collect it before
      // showing the confirmation. Otherwise (default) go straight to success.
      const requiresDeposit = !!biz?.requireDeposit;
      const requiresCard = !!biz?.collectCardOnFile;
      if (!apt.manageToken) throw new Error(isFrench ? "Jeton de session de réservation manquant — impossible de configurer le paiement" : "Booking session token missing — cannot set up payment");
      const intent = await api.payments.bookingIntent(apt.id, bizId, apt.manageToken).catch((e) => {
        if (requiresDeposit || requiresCard) {
          throw e;
        }
        return null;
      });
      if (intent?.required && intent.clientSecret && intent.publishableKey) {
        setPayInfo(intent);
      } else if (requiresDeposit || requiresCard || intent?.required) {
        toast.error(isFrench ? "Un paiement est requis pour cette réservation, mais il n’a pas pu être configuré. Veuillez communiquer avec l’entreprise." : "Payment is required for this booking but could not be set up. Please contact the business.");
      } else {
        setStep(4);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // Lost the race for this slot — first booker wins. Offer the waitlist using
      // the details they've already entered instead of a dead-end error.
      if (/no longer available|not available|already|taken/i.test(msg)) {
        setSlotTaken(true);
      } else {
        toast.error(msg || (isFrench ? "Échec de la réservation — veuillez réessayer" : "Booking failed — please try again"));
      }
    }
    finally { setSubmitting(false); }
  }

  async function joinWaitlist() {
    if (!wl.name.trim() || !/\S+@\S+\.\S+/.test(wl.email) || !bizId) { toast.error(isFrench ? "Entrez votre nom et un courriel valide" : "Enter your name and a valid email"); return; }
    setWlSaving(true);
    try {
      await api.waitlist.join(bizId, {
        name: wl.name.trim(),
        email: wl.email.trim(),
        serviceId: selectedServices[0]?.id,
        staffId: selectedStaff && selectedStaff !== "any" ? selectedStaff.id : undefined,
        desiredDate: selectedDate ? selectedDate.toISOString() : undefined,
        locale,
      });
      setWlDone(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : (isFrench ? "Impossible de rejoindre la liste d’attente" : "Could not join the waitlist")); }
    finally { setWlSaving(false); }
  }

  // Join the waitlist from the booking details the client already entered (used
  // when the chosen slot was taken by someone else mid-checkout).
  async function joinWaitlistFromBooking() {
    if (!bizId) return;
    if (!form.name.trim() || (!form.email.trim() && !form.phone.trim())) { toast.error(isFrench ? "Entrez votre nom et une adresse courriel ou un numéro de téléphone" : "Enter your name and an email address or phone number"); return; }
    setWlSaving(true);
    try {
      await api.waitlist.join(bizId, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() ? normalizePhoneE164(form.phone.trim()) : undefined,
        serviceId: selectedServices[0]?.id,
        staffId: selectedStaff && selectedStaff !== "any" ? selectedStaff.id : selectedSlot?.staffId,
        desiredDate: selectedSlot?.startsAt ?? (selectedDate ? selectedDate.toISOString() : undefined),
        notes: [form.notes.trim(), selectedSlot ? `Preferred slot: ${selectedSlot.startsAt}` : null].filter(Boolean).join(" | ") || undefined,
        locale,
      });
      setWlDone(true); // keep the panel open to show the success state
    } catch (e) { toast.error(e instanceof Error ? e.message : (isFrench ? "Impossible de rejoindre la liste d’attente" : "Could not join the waitlist")); }
    finally { setWlSaving(false); }
  }

  // Go back to pick a different time after losing a slot.
  function pickAnotherTime() {
    setSlotTaken(false);
    setSelectedSlot(null);
    setStep(2);
    if (selectedDate) loadSlots(selectedDate);
  }

  function reset() {
    setStep(0); setSelectedServices([]); setSelectedStaff(null); setSelectedDate(undefined);
    setSelectedSlot(null); setForm({ name: "", email: "", phone: "", notes: "" }); setCustomerAddress(""); setErrs({});
    setPolicyAccepted(false); setBooking(null); setSlots([]); setSelectedLocationId("");
  }

  const bookingSettings = (biz?.bookingPageSettings as Record<string, unknown> | null) ?? {};
  const brandColor = normalizeHexColor(bookingSettings.brandColor);
  const brandTextColor = bestTextOn(brandColor);
  const brandSoft = `${brandColor}18`;
  const hidePouredBy = !!bookingSettings.hidePouredBy;
  const bookingTagline = typeof bookingSettings.tagline === "string" ? bookingSettings.tagline.trim() : "";
  const localizedHeadline = isFrench && typeof bookingSettings.headlineFr === "string"
    ? bookingSettings.headlineFr.trim() : "";
  const bookingHeadline = localizedHeadline || (typeof bookingSettings.headline === "string" && bookingSettings.headline.trim()
    ? bookingSettings.headline.trim()
    : isFrench ? `Réserver avec ${biz?.name ?? "nous"}` : `Book with ${biz?.name ?? "us"}`);
  const bookingIntro = isFrench && typeof bookingSettings.introFr === "string"
    ? bookingSettings.introFr.trim()
    : typeof bookingSettings.intro === "string" ? bookingSettings.intro.trim() : "";
  const fontFamily = typeof bookingSettings.fontFamily === "string" ? bookingSettings.fontFamily : "default";
  const fontClass = {
    default: "font-sans",
    modern: "font-sans",
    elegant: "font-serif",
    bold: "font-sans",
  }[fontFamily] ?? "font-sans";
  const headlineClass = fontFamily === "bold" ? "font-black" : fontFamily === "modern" ? "tracking-tight" : "";

  if (loadingBiz) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!biz) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 text-center">
      <h2 className="text-xl font-bold text-gray-900 mb-2">{isFrench ? "Entreprise introuvable" : "Business not found"}</h2>
      <p className="text-gray-500 mb-6">{isFrench ? "La page de réservation que vous cherchez n’existe pas." : "The booking page you're looking for doesn't exist."}</p>
      <Link href="/" className="text-violet-600 font-medium hover:underline">{isFrench ? "Accueil" : "Go home"}</Link>
    </div>
  );

  async function leavePaymentStep(targetStep: 0 | 2 | 3) {
    const pendingBooking = booking;
    setPayInfo(null);
    setBooking(null);
    setCardSaved(false);
    setErrs({});

    if (targetStep === 0) {
      setSelectedServices([]);
      setSelectedStaff(null);
      setSelectedDate(undefined);
      setSelectedSlot(null);
      setSlots([]);
      setPolicyAccepted(false);
      setPromoResult(null);
      setStep(0);
    } else if (targetStep === 2) {
      setSelectedSlot(null);
      setPolicyAccepted(false);
      setStep(2);
      if (selectedDate) loadSlots(selectedDate);
    } else {
      setPolicyAccepted(false);
      setStep(3);
    }

    if (pendingBooking?.id && pendingBooking.manageToken) {
      api.appointments.publicCancel(pendingBooking.id, "Changed booking details before payment", pendingBooking.manageToken).catch(() => {});
    }
  }

  // Payment step: only when the business requires a deposit / card-on-file
  // (booking is already created as PENDING; this collects the deposit/card).
  if (payInfo && booking) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-900">{isFrench ? "Besoin de modifier quelque chose?" : "Need to change something?"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => leavePaymentStep(3)} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">
              {isFrench ? "Modifier les coordonnées" : "Edit details"}
            </button>
            <button type="button" onClick={() => leavePaymentStep(2)} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">
              {isFrench ? "Changer l’heure" : "Change time"}
            </button>
            <button type="button" onClick={() => leavePaymentStep(0)} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">
              {isFrench ? "Recommencer" : "Start over"}
            </button>
          </div>
        </div>
        <BookingPayment info={payInfo} onPaid={() => { if (payInfo?.mode === "setup") setCardSaved(true); setPayInfo(null); setStep(4); }} />
      </div>
    </div>
  );

  const today       = startOfDay(new Date());
  const advanceLimit = addMinutes(new Date(), biz?.maxAdvanceMinutes ?? ((biz?.maxAdvanceDays ?? 60) * 1440));
  const { morning, afternoon, evening } = groupSlots(slots);
  const totalMins   = selectedServices.reduce((s, x) => s + x.durationMinutes, 0);
  const subtotalCents = selectedServices.reduce((s, x) => s + x.priceCents, 0);
  const totalCents  = Math.max(0, subtotalCents - (promoResult?.discountCents ?? 0));
  const policy      = biz?.cancellationPolicy ?? (isFrench ? "Les rendez-vous annulés dans les 24 heures peuvent faire l’objet de frais d’annulation." : "Appointments cancelled within 24 hours may be subject to a cancellation fee.");

  // Sole-proprietor first: the provider step + per-person names only appear once
  // the business has an added non-owner provider. The owner-provider exists in
  // the API for booking logic, but should not make solo shops choose staff.
  const multiProvider = activeStaff.some((st) => st.user.role !== "OWNER");
  const locationRequired = (biz?.locations?.length ?? 0) > 1;
  const visibleServices = selectedLocationId
    ? allServices.filter((service) => activeStaff.some((staff) =>
        (staff.locationId === selectedLocationId || ((biz?.locations?.length ?? 0) === 1 && !staff.locationId)) &&
        (staff.staffServices.length === 0 || staff.staffServices.some((assignment) => assignment.serviceId === service.id)),
      ))
    : allServices;
  const selectedLocation = biz?.locations?.find((location) => location.id === selectedLocationId);
  const salonName     = biz?.name ?? (isFrench ? "votre prestataire" : "your provider");
  function providerText(staffName?: string): string {
    if (!multiProvider) return salonName;
    return staffName ? `${staffName} (${salonName})` : salonName;
  }
  const chosenStaffName = selectedStaff && selectedStaff !== "any"
    ? (selectedStaff as StaffMember).user.name
    : selectedSlot?.staffName;
  const stepLabels = isFrench
    ? (multiProvider ? ["Services", "Professionnel", "Date et heure", "Coordonnées"] : ["Services", "Date et heure", "Coordonnées"])
    : (multiProvider ? ["Services", "Provider", "Date & Time", "Details"] : ["Services", "Date & Time", "Details"]);
  const visualStep  = multiProvider ? step : (step === 0 ? 0 : step - 1);

  return (
    <div className={cn(isEmbed ? "bg-[#F8F9FA]" : "min-h-screen bg-[#F8F9FA]", fontClass)}>
      {isEmbed && (
        <div className="flex justify-end px-5 pt-3">
          <Link href={languageHref} hrefLang={isFrench ? "en-CA" : "fr-CA"} className="text-xs font-semibold text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg bg-white">
            {isFrench ? "English" : "Français"}
          </Link>
        </div>
      )}
      {/* Brand colour injection — scoped to booking page only */}
      <style>{`
        .bk-cta { background-color: ${brandColor}; color: ${brandTextColor}; }
        .bk-cta:hover { filter: brightness(0.88); }
        .bk-cta:disabled { filter: none; opacity: 0.4; }
        .bk-accent { background-color: ${brandColor}; }
        .bk-brand-soft { background-color: ${brandSoft}; }
        .bk-brand-text { color: ${brandColor}; }
        .bk-brand-border { border-color: ${brandColor}; }
        .bk-brand-border-soft { border-color: ${brandColor}33; }
        .bk-step-active { background-color: ${brandColor}; color: ${brandTextColor}; }
        .bk-step-current { box-shadow: 0 0 0 4px ${brandSoft}; }
        .bk-selected { border-color: ${brandColor} !important; background-color: ${brandSoft} !important; }
        .bk-selected-text { color: ${brandColor} !important; }
        .bk-slot-sel { background-color: ${brandColor} !important; border-color: ${brandColor} !important; color: ${brandTextColor} !important; }
        .bk-option:hover { border-color: ${brandColor}66; background-color: ${brandSoft}; }
        .bk-link:hover { color: ${brandColor}; }
        .bk-input:focus { outline: none; box-shadow: 0 0 0 2px ${brandColor}55; }
        .bk-check { accent-color: ${brandColor}; }
      `}</style>

      {/* Nav — hidden in embed mode (the widget lives on the salon's own site) */}
      {!isEmbed && (
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {biz?.logoUrl ? (
              <Image src={biz.logoUrl} alt={`${biz.name} logo`} width={28} height={28} className="w-7 h-7 rounded-xl object-cover shrink-0" priority />
            ) : (
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bk-accent">
                <Calendar className="w-3.5 h-3.5" style={{ color: brandTextColor }} />
              </div>
            )}
            <span className="font-bold text-gray-900 truncate">{biz?.name ?? "Pulse"}</span>
            {biz?.verificationStatus === "VERIFIED" && <VerifiedBadge className="shrink-0" />}
          </div>
          {/* Signed-in viewers get a way back; guests can't sign in yet, so no link. */}
          {homeHref && (
            <div className="flex items-center gap-3 text-sm shrink-0">
              <Link href={homeHref}
                className="text-xs font-medium text-gray-600 transition-colors border border-gray-200 px-3 py-1.5 rounded-lg bk-option">
                {navUser?.role === "CLIENT" ? (isFrench ? "Mes réservations" : "My bookings") : (isFrench ? "Retour au tableau de bord" : "Back to dashboard")}
              </Link>
            </div>
          )}
          <Link
            href={languageHref}
            hrefLang={isFrench ? "en-CA" : "fr-CA"}
            className="text-xs font-semibold text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg bk-option"
            aria-label={isFrench ? "Afficher cette page en anglais" : "View this page in French"}
          >
            {isFrench ? "English" : "Français"}
          </Link>
        </div>
      </nav>
      )}

      <main id="main-content" className="max-w-2xl mx-auto px-5 py-8">
        {step !== 4 && !slotTaken && (
          <section className="mb-5 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              {biz?.logoUrl ? (
                <Image src={biz.logoUrl} alt={`${biz.name} logo`} width={44} height={44} className="h-11 w-11 rounded-xl object-cover shrink-0" priority />
              ) : (
                <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bk-accent">
                  <Calendar className="h-5 w-5" style={{ color: brandTextColor }} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{biz?.name}</p>
                <h1 className={cn("text-xl font-bold text-gray-950 leading-tight", headlineClass)}>{bookingHeadline}</h1>
                {bookingIntro && <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{bookingIntro}</p>}
                {bookingTagline && <p className="mt-1.5 text-sm italic text-gray-500">{bookingTagline}</p>}
              </div>
            </div>
          </section>
        )}

        {/* Prestige: verified businesses get a trust strip that reassures clients */}
        {biz?.verificationStatus === "VERIFIED" && step !== 4 && !slotTaken && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border bk-brand-border-soft bk-brand-soft px-3 py-2">
            <ShieldCheck className="w-3.5 h-3.5 bk-brand-text shrink-0" />
            <p className="text-xs text-gray-700">
              {isFrench ? (
                <><span className="font-semibold text-gray-900">{biz?.name}</span> est une <span className="font-semibold bk-brand-text">entreprise vérifiée par Pulse</span> — identité confirmée pour une réservation fiable et en toute confiance.</>
              ) : (
                <><span className="font-semibold text-gray-900">{biz?.name}</span> is a <span className="font-semibold bk-brand-text">Pulse-verified business</span> — identity confirmed for safe, trusted booking.</>
              )}
            </p>
          </div>
        )}
        {/* Slot taken mid-checkout → offer the waitlist with details already entered */}
        {slotTaken ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            {wlDone ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                  <Check className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{isFrench ? "Vous êtes sur la liste d’attente" : "You're on the waitlist"}</h2>
                <p className="text-gray-500 mb-6">{isFrench ? <>Nous écrirons à <span className="font-medium text-gray-800">{form.email}</span> dès qu’une place correspondante se libère.</> : <>We&apos;ll email <span className="font-medium text-gray-800">{form.email}</span> the moment a matching spot opens up.</>}</p>
                <button onClick={() => { setSlotTaken(false); setWlDone(false); pickAnotherTime(); }}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-colors bk-cta">
                  {isFrench ? "Essayer une autre heure" : "Try another time"}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 mb-5">
                  <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{isFrench ? "Cette heure vient d’être réservée" : "That time was just booked"}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{isFrench
                      ? <>Quelqu’un a réservé{selectedSlot ? ` ${format(parseISO(selectedSlot.startsAtLocal.slice(0, 19)), "EEE d MMM 'à' HH:mm", dateLocale)}` : " ce créneau"} juste avant vous. Voulez-vous que l’on vous avertisse s’il se libère?</>
                      : <>Someone grabbed{selectedSlot ? ` ${format(parseISO(selectedSlot.startsAtLocal.slice(0, 19)), "EEE, MMM d 'at' HH:mm")}` : " this slot"} a moment before you. Want us to notify you if it opens back up?</>}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm space-y-1 mb-5">
                  <div className="flex justify-between"><span className="text-gray-500">{isFrench ? "Service" : "Service"}</span><span className="font-medium text-gray-800">{selectedServices.map((s) => s.name).join(" + ")}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">{isFrench ? "Nom" : "Name"}</span><span className="font-medium text-gray-800">{form.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">{isFrench ? "Courriel" : "Email"}</span><span className="font-medium text-gray-800 truncate ml-3">{form.email}</span></div>
                  {selectedDate && <div className="flex justify-between"><span className="text-gray-500">{isFrench ? "Jour souhaité" : "Preferred day"}</span><span className="font-medium text-gray-800">{format(selectedDate, "EEE d MMM", dateLocale)}</span></div>}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={pickAnotherTime}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    {isFrench ? "Choisir une autre heure" : "Pick another time"}
                  </button>
                  <button onClick={joinWaitlistFromBooking} disabled={wlSaving}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors bk-cta">
                    {wlSaving ? (isFrench ? "Ajout en cours…" : "Adding you…") : (isFrench ? "Oui, ajoutez-moi à la liste d’attente" : "Yes, add me to the waitlist")}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : step === 4 && booking ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{isFrench ? "Votre réservation est confirmée" : "Your Booking is Confirmed"}</h2>
            <p className="text-sm bk-brand-text font-medium mb-2">{isFrench ? "Tout est prêt!" : "You're all set!"}</p>
            <p className="text-gray-500 mb-1">{isFrench ? "Confirmation envoyée à " : "Confirmation sent to "}<span className="font-medium text-gray-800">{[form.email, form.phone].filter(Boolean).join(isFrench ? " et " : " and ")}</span></p>
            <p className="text-xs text-gray-400 font-mono mb-3">#{booking.id.slice(-8).toUpperCase()}</p>
            {clientMatched && (
              <p className="mb-6 inline-flex items-center gap-1.5 rounded-full bk-brand-soft border bk-brand-border-soft px-3 py-1 text-xs font-medium bk-brand-text">
                <Check className="w-3.5 h-3.5" /> {isFrench ? `Synchronisé avec votre profil existant chez ${biz?.name ?? "cette entreprise"}` : `Synced to your existing profile with ${biz?.name ?? "this business"}`}
              </p>
            )}
            {!clientMatched && <div className="mb-6" />}

            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6 text-sm">
              {selectedServices.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span className="text-gray-600">{s.name}</span>
                  <span className="font-medium text-gray-800">{fmtPrice(s.priceCents, biz?.currency as "CAD" | "USD", locale)}</span>
                </div>
              ))}
              <hr className="border-gray-200" />
              {(biz?.taxRatePercent ?? 0) > 0 && (
                <>
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>{isFrench ? "Sous-total" : "Subtotal"}</span><span>{fmtPrice(totalCents, biz?.currency as "CAD" | "USD", locale)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>{isFrench ? "Taxe" : "Tax"} ({biz!.taxRatePercent}%)</span><span>{fmtPrice(Math.round(totalCents * (biz!.taxRatePercent! / 100)), biz?.currency as "CAD" | "USD", locale)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="bk-brand-text">{fmtPrice(totalCents + Math.round(totalCents * ((biz?.taxRatePercent ?? 0) / 100)), biz?.currency as "CAD" | "USD", locale)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-xs pt-1">
                <span>{isFrench ? "Durée" : "Duration"}</span><span>{fmtDuration(totalMins)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-xs">
                <span>{isFrench ? "Quand" : "When"}</span>
                <span>{selectedDate && format(selectedDate, isFrench ? "EEE d MMM" : "EEE, MMM d", dateLocale)} · {selectedSlot && format(parseISO(selectedSlot.startsAtLocal.slice(0, 19)), isFrench ? "HH:mm" : "h:mm a", dateLocale)}</span>
              </div>
            </div>

            {booking.locationMode === "VIRTUAL" && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-left mb-6">
                <p className="text-sm font-semibold text-indigo-900 mb-1">💻 {isFrench ? "Rendez-vous en ligne" : "Online appointment"}</p>
                {booking.meetingUrl ? (
                  <a href={booking.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-700 underline break-all">{isFrench ? "Rejoindre l’appel vidéo" : "Join the video call"}</a>
                ) : (
                  <p className="text-sm text-indigo-700">{isFrench ? "Le lien de votre rencontre sera inclus dans votre courriel de confirmation et vos rappels." : "Your meeting link will be included in your confirmation email and reminders."}</p>
                )}
              </div>
            )}
            {booking.locationMode === "CUSTOMER" && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-left mb-6">
                <p className="text-sm font-semibold text-indigo-900 mb-1">🚗 {isFrench ? "Nous nous déplaçons chez vous" : "We come to you"}</p>
                <p className="text-sm text-indigo-700">{booking.customerAddress || (isFrench ? "Nous vous contacterons pour confirmer votre adresse." : "We'll be in touch to confirm your address.")}</p>
              </div>
            )}
            {booking.locationMode === "PHONE" && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-left mb-6">
                <p className="text-sm font-semibold text-indigo-900 mb-1">📞 {isFrench ? "Rendez-vous téléphonique" : "Phone appointment"}</p>
                <p className="text-sm text-indigo-700">{isFrench ? `Nous vous appellerons au ${form.phone || "votre numéro"} à l’heure de votre rendez-vous.` : `We'll call you at ${form.phone || "your number"} at your appointment time.`}</p>
              </div>
            )}
            {(booking.locationMode === "IN_PERSON" || !booking.locationMode) && (booking.location || selectedLocation) && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-left mb-6">
                <p className="text-sm font-semibold text-indigo-900 mb-1">{isFrench ? "Lieu du rendez-vous" : "Appointment location"}</p>
                <p className="text-sm font-medium text-indigo-800">{booking.location?.name || selectedLocation?.name}</p>
                {(booking.location?.address || selectedLocation?.address) && (
                  <p className="text-sm text-indigo-700">{booking.location?.address || selectedLocation?.address}</p>
                )}
              </div>
            )}

            <div className="flex justify-center mb-4">
              {booking && selectedSlot && (
                <AddToCalendar
                  appointmentId={booking.id}
                  title={`${selectedServices.map(s => s.name).join(" + ")} ${isFrench ? "chez" : "at"} ${biz?.name ?? "Salon"}`}
                  startsAt={booking.startsAt}
                  endsAt={booking.endsAt}
                  description={`${isFrench ? "Avec" : "With"} ${providerText(chosenStaffName)}`}
                  location={booking.location?.address || booking.location?.name || biz?.address}
                />
              )}
            </div>

            <div className="flex gap-3 mb-4">
              <Link href={`/appointments/${booking.id}/manage${booking.manageToken ? `#token=${encodeURIComponent(booking.manageToken)}` : ''}`}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 text-center transition-colors">
                {isFrench ? "Gérer la réservation" : "Manage booking"}
              </Link>
              <button onClick={reset}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors bk-cta">
                {isFrench ? "Réserver à nouveau" : "Book another"}
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-2">
              {isFrench ? "Nous vous avons envoyé une confirmation par courriel avec un lien pour gérer cette réservation." : "We've emailed your confirmation with a link to manage this booking."}
            </p>
            {cardSaved && (
              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 text-left">
                <p className="text-xs font-semibold text-gray-700 mb-0.5">{isFrench ? "Carte enregistrée" : "Card on file"}</p>
                <p className="text-xs text-gray-500">{isFrench
                  ? <>Votre carte a été enregistrée de façon sécuritaire avec Stripe pour la protection contre les absences et annulations. Vous pouvez la retirer en tout temps depuis votre <a href="/my/dashboard" className="bk-brand-text font-medium hover:underline">portail client</a>.</>
                  : <>Your card has been securely saved with Stripe for no-show/cancellation protection. You can remove it anytime from your <a href="/my/dashboard" className="bk-brand-text font-medium hover:underline">client portal</a>.</>}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <StepBar labels={stepLabels} current={visualStep} isFrench={isFrench} />
            </div>

            {/* ── Step 0: Services ──────────────────────────────────────── */}
            {step === 0 && (
              <div className="px-6 pb-6">
                {/* A branch choice is required when the business has multiple locations. */}
                {(biz?.locations?.length ?? 0) > 1 && (
                  <div className="mb-5">
                    <p className="text-sm font-medium text-gray-700 mb-2">{isFrench ? "Choisir un emplacement" : "Choose a location"} <span className="text-red-500">*</span></p>
                    <div className="flex flex-wrap gap-2">
                      {biz!.locations!.map((l) => (
                        <button key={l.id} onClick={() => {
                          setSelectedLocationId(l.id);
                          setSelectedServices([]);
                          setSelectedStaff(null);
                          setSelectedDate(undefined);
                          setSelectedSlot(null);
                        }}
                          className={cn("rounded-xl border px-3 py-2 text-left transition-colors",
                            selectedLocationId === l.id ? "bk-selected" : "border-gray-200 bk-option")}>
                          <span className={cn("block text-sm font-semibold", selectedLocationId === l.id ? "bk-selected-text" : "text-gray-800")}>{l.name}</span>
                          {l.address && <span className="block text-xs text-gray-400">{l.address}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <h2 className="text-lg font-bold text-gray-900 mb-1">{isFrench ? "Choisir les services" : "Choose services"}</h2>
                <p className="text-sm text-gray-400 mb-4">{isFrench ? "Sélectionnez un ou plusieurs services" : "Select one or more services"}</p>

                {revStats && revStats.count > 0 && (
                  <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={n <= Math.round(revStats.average) ? "w-4 h-4 fill-amber-400 text-amber-400" : "w-4 h-4 text-gray-200"} />
                        ))}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{revStats.average.toFixed(1)}</span>
                      <span className="text-xs text-gray-400">· {revStats.count} {isFrench ? "avis" : `review${revStats.count === 1 ? "" : "s"}`}</span>
                    </div>
                    {revStats.reviews.find((r) => r.comment) && (
                      <p className="text-xs text-gray-500 mt-1.5 italic line-clamp-2">
                        &ldquo;{revStats.reviews.find((r) => r.comment)!.comment}&rdquo; — {revStats.reviews.find((r) => r.comment)!.clientName}
                      </p>
                    )}
                  </div>
                )}

                {visibleServices.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">
                    {selectedLocationId ? (isFrench ? "Aucun service n’est offert à cet emplacement." : "No services are available at this location.") : (isFrench ? "Aucun service disponible" : "No services available")}
                  </p>
                )}

                {/* Group by category */}
                {(() => {
                  const catIds = [...new Set(visibleServices.map(s => s.category?.id ?? null))];
                  const catNames: Record<string, string> = {};
                  const catColors: Record<string, string> = {};
                  visibleServices.forEach(s => { if (s.category) { catNames[s.category.id] = s.category.name; catColors[s.category.id] = s.category.color; } });
                  return catIds.map(catId => {
                    const svcs = visibleServices.filter(s => (s.category?.id ?? null) === catId);
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
                              <button key={svc.id} onClick={() => toggleService(svc)} aria-pressed={selected}
                                className={cn(
                                  "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                                  selected ? "bk-selected" : "border-gray-100 bk-option",
                                )}>
                                <div className="w-2.5 h-10 rounded-full shrink-0" style={{ background: svc.color }} />
                                <div className="flex-1 min-w-0">
                                  <p className={cn("font-semibold text-sm", selected ? "bk-selected-text" : "text-gray-900")}>{svc.name}</p>
                                  {svc.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{svc.description}</p>}
                                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />{fmtDuration(svc.durationMinutes)}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={cn("font-bold text-sm", selected ? "bk-selected-text" : "text-gray-700")}>{fmtPrice(svc.priceCents)}</p>
                                </div>
                                <div className={cn(
                                  "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                  selected ? "bk-accent bk-brand-border" : "border-gray-300",
                                )}>
	                                  {selected && <Check className="w-3 h-3" style={{ color: brandTextColor }} />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}

                <CartBar services={selectedServices} onClear={(id) => setSelectedServices((p) => p.filter((s) => s.id !== id))} locale={locale} />

                <div className="mt-5">
                  <button
                    onClick={() => { if (multiProvider) { setStep(1); } else { setSelectedStaff(staffList[0] ?? "any"); setStep(2); } }}
                    disabled={selectedServices.length === 0 || (locationRequired && !selectedLocationId) || staffList.length === 0}
	                    className="w-full py-3.5 rounded-xl font-semibold text-sm transition-colors bk-cta">
                    {isFrench ? "Continuer" : "Continue"} — {selectedServices.length > 0 ? `${selectedServices.length} service${selectedServices.length > 1 ? "s" : ""} · ${fmtPrice(totalCents, biz?.currency as "CAD" | "USD", locale)}` : (isFrench ? "choisir des services" : "select services")}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 1: Staff ─────────────────────────────────────────── */}
            {step === 1 && (
              <div className="px-6 pb-6">
	                <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-gray-400 bk-link mb-4 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> {isFrench ? "Retour" : "Back"}
                </button>
                <h2 className="text-lg font-bold text-gray-900 mb-1">{isFrench ? "Choisir un professionnel" : "Choose a provider"}</h2>
                <p className="text-sm text-gray-400 mb-4">{isFrench ? "Choisissez la personne souhaitée ou laissez-nous choisir" : "Pick who you'd like to see, or let us choose"}</p>

                <div className="space-y-2">
                  {/* Any available */}
                  <button
                    onClick={() => { setSelectedStaff("any"); setStep(2); }}
                    disabled={staffList.length === 0}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                      staffList.length === 0 && "opacity-50 cursor-not-allowed",
	                      selectedStaff === "any" ? "bk-selected" : "border-gray-100 bk-option",
                    )}>
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-lg">✨</div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-900">{isFrench ? "Toute personne disponible" : "Any available"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{isFrench ? "Meilleures disponibilités parmi tous les professionnels" : "Best availability across all providers"}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>

                  {staffList.length === 0 && (
                    <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      {isFrench ? "Aucun professionnel n’est encore assigné à tous les services sélectionnés." : "No provider is assigned to every selected service yet."}
                    </p>
                  )}

                  {staffList.map((st) => (
                    <button key={st.id}
                      onClick={() => { setSelectedStaff(st); setStep(2); }}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                        selectedStaff !== "any" && (selectedStaff as StaffMember)?.id === st.id
	                          ? "bk-selected"
	                          : "border-gray-100 bk-option",
                      )}>
	                      <div className="w-10 h-10 rounded-full bk-brand-soft flex items-center justify-center bk-brand-text font-bold text-sm shrink-0">
                        {st.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900">{st.user.name} <span className="font-normal text-gray-400">({salonName})</span></p>
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
	                <button onClick={() => setStep(multiProvider ? 1 : 0)} className="flex items-center gap-1 text-sm text-gray-400 bk-link mb-4 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> {isFrench ? "Retour" : "Back"}
                </button>
                <h2 className="text-lg font-bold text-gray-900 mb-4">{isFrench ? "Choisir une date et une heure" : "Pick a date & time"}</h2>

                <DayPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={pickDate}
                  disabled={(date) => isBefore(date, today) || isAfter(startOfDay(date), startOfDay(advanceLimit))}
                  className="mx-auto"
                  locale={isFrench ? frCA : undefined}
                />

                {selectedDate && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      {format(selectedDate, "EEEE, MMMM d", dateLocale)}
                    </p>
                    {loadingSlots ? (
                      <p className="text-sm text-gray-400 text-center py-4">{isFrench ? "Chargement des disponibilités…" : "Loading available times…"}</p>
                    ) : slots.length === 0 ? (
                      <div className="py-2">
                        {wlDone ? (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                              <Check className="w-6 h-6 text-emerald-600" />
                            </div>
                            <p className="text-base font-bold text-emerald-800">{isFrench ? "Vous êtes sur la liste d’attente!" : "You're on the waitlist!"}</p>
                            <p className="text-sm text-emerald-600 mt-1">{isFrench ? "Nous vous écrirons dès qu’une place correspondante se libère." : "We'll email you the moment a matching spot frees up."}</p>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white p-5">
                            <div className="flex items-start gap-3 mb-4">
	                              <div className="w-10 h-10 rounded-xl bk-brand-soft flex items-center justify-center shrink-0">
	                                <Clock className="w-5 h-5 bk-brand-text" />
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-gray-900">{isFrench ? "Complet pour cette journée" : "Fully booked on this day"}</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{isFrench ? "Inscrivez-vous à la liste d’attente et nous vous écrirons dès qu’une place se libère — ou essayez une autre date." : "Join the waitlist and we'll email you the instant a spot opens — or try another date."}</p>
                              </div>
                            </div>
                            <div className="space-y-2.5">
	                              <input className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 bk-input transition-shadow"
                                placeholder={isFrench ? "Votre nom" : "Your name"} value={wl.name} onChange={(e) => setWl((p) => ({ ...p, name: e.target.value }))} />
	                              <input className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 bk-input transition-shadow"
                                placeholder={isFrench ? "vous@exemple.com" : "you@example.com"} type="email" value={wl.email} onChange={(e) => setWl((p) => ({ ...p, email: e.target.value }))} />
                              <button type="button" onClick={joinWaitlist} disabled={wlSaving}
	                                className="w-full text-sm font-semibold rounded-xl py-3 transition-colors bk-cta">
                                {wlSaving ? (isFrench ? "Inscription…" : "Joining…") : (isFrench ? "Avertissez-moi dès qu’une place se libère" : "Notify me when a spot opens")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {[{ key: "morning", label: isFrench ? "Matin" : "Morning", icon: Sun, slots: morning },
                          { key: "afternoon", label: isFrench ? "Après-midi" : "Afternoon", icon: Sunset, slots: afternoon },
                          { key: "evening", label: isFrench ? "Soir" : "Evening", icon: Moon, slots: evening }
                        ].filter((g) => g.slots.length > 0).map(({ key, label, icon: Icon, slots: s }) => (
                          <div key={key}>
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                              <Icon className="w-3.5 h-3.5" />{label}
                            </p>
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                              {s.map((sl) => (
                                <button key={`${sl.staffId ?? "staff"}-${sl.startsAt}`}
                                  onClick={() => { setSelectedSlot(sl); setStep(3); }}
                                  aria-pressed={selectedSlot?.startsAt === sl.startsAt}
                                  className={cn(
                                    "py-2.5 rounded-xl border text-xs font-semibold transition-all",
                                    selectedSlot?.startsAt === sl.startsAt
	                                      ? "bk-slot-sel"
	                                      : "border-gray-200 text-gray-700 bk-option",
                                  )}>
                                  {format(parseISO(sl.startsAtLocal.slice(0, 19)), isFrench ? "HH:mm" : "h:mm a", dateLocale)}
                                  {selectedStaff === "any" && sl.staffName && <span className="block truncate px-1 text-[10px] font-medium opacity-70">{sl.staffName}</span>}
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
	                <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-gray-400 bk-link mb-4 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> {isFrench ? "Retour" : "Back"}
                </button>
                <h2 className="text-lg font-bold text-gray-900 mb-1">{isFrench ? "Vos coordonnées" : "Your details"}</h2>

                {/* Booking summary */}
	                <div className="bk-brand-soft rounded-xl p-4 mb-5 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
	                      <p className="font-semibold bk-brand-text">
                        {selectedServices.map((s) => s.name).join(" + ")}
                      </p>
	                      <p className="bk-brand-text mt-0.5 opacity-80">
                        {selectedDate && format(selectedDate, isFrench ? "EEE d MMM" : "EEE, MMM d", dateLocale)}
                        {selectedSlot && ` ${isFrench ? "à" : "at"} ${format(parseISO(selectedSlot.startsAtLocal.slice(0, 19)), isFrench ? "HH:mm" : "h:mm a", dateLocale)}`}
                        {` · ${providerText(chosenStaffName)}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
	                      <p className="font-bold bk-brand-text">{fmtPrice(totalCents, biz?.currency as "CAD" | "USD", locale)}</p>
	                      <p className="bk-brand-text text-xs opacity-70">{fmtDuration(totalMins)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {([
                    { k: "name",  label: isFrench ? "Nom complet *" : "Full name *", type: "text", ph: "Jane Smith" },
                    { k: "email", label: isFrench ? "Courriel" : "Email", type: "email", ph: "jane@example.com" },
                    { k: "phone", label: isFrench ? "Téléphone" : "Phone", type: "tel", ph: "+1 (416) 555-0123" },
                    { k: "notes", label: isFrench ? "Notes (facultatif)" : "Notes (optional)", type: "text", ph: isFrench ? "Y a-t-il quelque chose à savoir?" : "Anything we should know?" },
                  ] as const).map(({ k, label, type, ph }) => (
                    <div key={k}>
                      <label htmlFor={`field-${k}`} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                      <input
                        id={`field-${k}`}
                        type={type}
                        placeholder={ph}
                        value={form[k]}
                        aria-invalid={!!errs[k]}
                        aria-describedby={errs[k] ? `error-${k}` : undefined}
                        onChange={(e) => {
                          const val = k === "phone" ? formatPhoneInput(e.target.value) : e.target.value;
                          setForm((p) => ({ ...p, [k]: val }));
                          setErrs((p) => ({ ...p, [k]: "" }));
                        }}
                        className={cn(
	                          "w-full px-3 py-2.5 text-sm border rounded-xl bg-white text-gray-900 placeholder:text-gray-400 bk-input transition-shadow",
                          errs[k] ? "border-red-400" : "border-gray-200",
                        )}
                      />
                      {errs[k] && <p id={`error-${k}`} role="alert" className="text-xs text-red-500 mt-1">{errs[k]}</p>}
                    </div>
                  ))}

                  {/* Delivery-mode specifics for the primary service. */}
                  {(selectedServices[0]?.locationMode ?? "IN_PERSON") === "CUSTOMER" && (
                    <div>
                      <label htmlFor="field-customerAddress" className="block text-sm font-medium text-gray-700 mb-1.5">{isFrench ? "Votre adresse *" : "Your address *"}</label>
                      <input
                        id="field-customerAddress"
                        type="text"
                        placeholder={isFrench ? "Rue, app., ville" : "Street, unit, city"}
                        value={customerAddress}
                        aria-invalid={!!errs.customerAddress}
                        aria-describedby={errs.customerAddress ? "error-customerAddress" : undefined}
                        onChange={(e) => { setCustomerAddress(e.target.value); setErrs((p) => ({ ...p, customerAddress: "" })); }}
                        className={cn(
                          "w-full px-3 py-2.5 text-sm border rounded-xl bg-white text-gray-900 placeholder:text-gray-400 bk-input transition-shadow",
                          errs.customerAddress ? "border-red-400" : "border-gray-200",
                        )}
                      />
                      <p className="text-xs text-gray-500 mt-1">{isFrench ? "Il s’agit d’un service mobile — nous nous déplaçons chez vous." : "This is a mobile service — we'll come to you."}</p>
                      {errs.customerAddress && <p id="error-customerAddress" role="alert" className="text-xs text-red-500 mt-1">{errs.customerAddress}</p>}
                    </div>
                  )}
                  {(selectedServices[0]?.locationMode ?? "IN_PERSON") === "VIRTUAL" && (
                    <p className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
                      {isFrench ? "💻 Rendez-vous en ligne — un lien de rencontre vidéo sera envoyé dans votre confirmation et vos rappels." : "💻 Online appointment — a video meeting link will be sent in your confirmation and reminders."}
                    </p>
                  )}
                  {(selectedServices[0]?.locationMode ?? "IN_PERSON") === "PHONE" && (
                    <p className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
                      {isFrench ? "📞 Rendez-vous téléphonique — nous vous appellerons au numéro ci-dessus à l’heure de votre rendez-vous." : "📞 Phone appointment — we'll call you at the number above at your appointment time."}
                    </p>
                  )}

                  {/* Intake / consultation questions (owner-defined) */}
                  {(biz?.intakeQuestions ?? []).map((q) => (
                    <div key={q.id}>
                      <label htmlFor={`intake-${q.id}`} className="block text-sm font-medium text-gray-700 mb-1.5">
                        {q.label}{q.required ? " *" : ""}
                      </label>
                      <textarea
                        id={`intake-${q.id}`}
                        value={intake[q.id] ?? ""}
                        onChange={(e) => { setIntake((p) => ({ ...p, [q.id]: e.target.value })); setErrs((p) => ({ ...p, [`intake_${q.id}`]: "" })); }}
                        placeholder={isFrench ? "Votre réponse" : "Your answer"}
                        aria-required={q.required || undefined}
                        aria-invalid={!!errs[`intake_${q.id}`]}
                        aria-describedby={errs[`intake_${q.id}`] ? `intake-err-${q.id}` : undefined}
                        className={cn(
	                          "w-full px-3 py-2.5 text-sm border rounded-xl bg-white text-gray-900 placeholder:text-gray-400 bk-input min-h-[64px]",
                          errs[`intake_${q.id}`] ? "border-red-400" : "border-gray-200",
                        )} />
                      {errs[`intake_${q.id}`] && <p id={`intake-err-${q.id}`} className="text-xs text-red-500 mt-1">{errs[`intake_${q.id}`]}</p>}
                    </div>
                  ))}

                  {/* Promo code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{isFrench ? "Code promo (facultatif)" : "Promo code (optional)"}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={isFrench ? "ex. ETE20" : "e.g. SUMMER20"}
                        value={promoCode}
                        onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); }}
	                        className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 bk-input uppercase"
                      />
                      <button
                        type="button"
                        disabled={!promoCode.trim() || promoChecking}
                        onClick={async () => {
                          if (!bizId || !promoCode.trim()) return;
                          setPromoChecking(true);
                          try {
                            const r = await api.promoCodes.validate(bizId, promoCode, subtotalCents);
                            setPromoResult({ id: r.id, discountCents: r.discountCents, label: r.discountType === "PERCENT" ? (isFrench ? `${r.discountValue} % de rabais` : `${r.discountValue}% off`) : `${fmtPrice(r.discountCents, biz?.currency as "CAD" | "USD", locale)} ${isFrench ? "de rabais" : "off"}` });
                          } catch { setPromoResult(null); toast.error(isFrench ? "Code promo invalide ou expiré" : "Invalid or expired promo code"); }
                          finally { setPromoChecking(false); }
                        }}
	                        className="px-4 py-2.5 text-sm rounded-xl font-medium disabled:opacity-40 transition-colors bk-cta"
                      >
                        {promoChecking ? "…" : (isFrench ? "Appliquer" : "Apply")}
                      </button>
                    </div>
                    {promoResult && (
                      <p className="text-xs text-green-600 mt-1.5 font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> {isFrench ? `${promoResult.label} appliqué` : `${promoResult.label} applied`}
                      </p>
                    )}
                  </div>

                  {/* Source tracking */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{isFrench ? "Comment avez-vous entendu parler de nous?" : "How did you hear about us?"} <span className="text-gray-400 font-normal">{isFrench ? "(facultatif)" : "(optional)"}</span></label>
                    <select
                      value={referralSource}
                      onChange={(e) => setReferralSource(e.target.value)}
	                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 bk-input"
                    >
                      <option value="">{isFrench ? "Sélectionnez une option…" : "Select one…"}</option>
                      <option value="Instagram">Instagram</option>
                      <option value="TikTok">TikTok</option>
                      <option value="Google">Google</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Referral">{isFrench ? "Ami ou recommandation" : "Friend or referral"}</option>
                      <option value="Walk-in">{isFrench ? "Sans rendez-vous / affiche vue" : "Walk-in / saw sign"}</option>
                      <option value="Returning">{isFrench ? "Client de retour" : "Returning client"}</option>
                      <option value="Other">{isFrench ? "Autre" : "Other"}</option>
                    </select>
                  </div>

                  {/* Cancellation policy */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-2">
                      <AlertCircle className="w-3.5 h-3.5" /> {isFrench ? "Politique d’annulation" : "Cancellation policy"}
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">{policy}</p>
                    <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
                      <input
                        id="policy-accepted"
                        type="checkbox"
                        checked={policyAccepted}
                        onChange={(e) => setPolicyAccepted(e.target.checked)}
	                        className="mt-0.5 w-4 h-4 bk-check shrink-0"
                      />
                      <span className="text-xs text-amber-800 font-medium">
                        {isFrench ? "J’ai lu et j’accepte la politique d’annulation" : "I have read and agree to the cancellation policy"}
                      </span>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={confirm}
                      disabled={submitting || !policyAccepted}
	                      className="w-full py-4 rounded-xl font-semibold text-sm transition-colors bk-cta">
                      {submitting ? (isFrench ? "Réservation…" : "Booking…") : `${isFrench ? "Confirmer la réservation" : "Confirm booking"} · ${fmtPrice(totalCents, biz?.currency as "CAD" | "USD", locale)}`}
                    </button>
                    <p className="text-[10px] text-gray-400 text-center px-4 leading-relaxed">
                      {isFrench
                        ? "Les paiements sont traités de façon sécuritaire par Stripe. Des frais de traitement peuvent s’appliquer selon l’entente Stripe de l’entreprise. Pulse ne conserve aucun numéro de carte."
                        : "Payments are processed securely by Stripe. Stripe processing fees may apply under the business's Stripe agreement. Pulse does not store card numbers."}
                    </p>
                    <p className="text-[10px] text-gray-400 text-center px-4 leading-relaxed">
                      {isFrench
                        ? "En confirmant, vous acceptez que votre nom, vos coordonnées et les renseignements sur votre rendez-vous soient recueillis et conservés par cette entreprise et traités par "
                        : "By confirming, your name, contact details, and appointment information are collected and stored by this business and processed by "}
	                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline bk-link">Pulse</a>{" "}
                      {isFrench ? " à titre de plateforme de réservation. Consultez la " : "as its booking platform. View Pulse's "}
	                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline bk-link">{isFrench ? "politique de confidentialité" : "Privacy Policy"}</a>
                      {isFrench ? " de Pulse." : "."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!hidePouredBy && (
          <p className="text-center text-xs text-gray-400 mt-4">
	            {isFrench ? "Propulsé par" : "Powered by"} <span className="bk-brand-text font-medium">Pulse</span>
          </p>
        )}
      </main>
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
