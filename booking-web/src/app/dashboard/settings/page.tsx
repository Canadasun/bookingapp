"use client";

import { useEffect, useState, Suspense, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Copy, Check, Globe, Clock, DollarSign, Building2, ChevronRight, CreditCard, Zap, CheckCircle2, Bell, ShieldCheck, CalendarDays, Plus, Trash2, ClipboardList, AlertTriangle, MapPin, Banknote, ExternalLink, Download, QrCode, Palette, Type, Braces } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – react-qr-code ships types but they're not resolved via "exports"; works fine at runtime
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { api, Business, VerificationStatus, IntakeQuestion, Location } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ImageUpload } from "@/components/ImageUpload";
import { cn, formatPhoneInput, formatPhoneDisplay } from "@/lib/utils";
import { useEvents } from "@/lib/hooks";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { trackEvent } from "@/lib/analytics";

const TIMEZONES = [
  "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "America/Anchorage","Pacific/Honolulu","America/Toronto","America/Vancouver",
  "America/Edmonton","America/Winnipeg","America/Regina","America/Halifax",
  "America/St_Johns","America/Whitehorse",
  "Europe/London","Europe/Paris","Europe/Berlin","Asia/Dubai","Asia/Kolkata",
  "Asia/Singapore","Asia/Tokyo","Australia/Sydney","Pacific/Auckland",
];

type Section = "profile" | "locations" | "booking" | "calendar" | "payments" | "payouts" | "online" | "branding" | "notifications" | "security" | "billing";
type SubscriptionDetails = {
  plan: string;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasBilling: boolean;
};

const SECTIONS: { id: Section; label: string; icon: React.ElementType; desc: string; group: string }[] = [
  { id: "profile",       label: "Business profile",   icon: Building2,    desc: "Name, contact info, timezone",          group: "Business" },
  { id: "locations",     label: "Locations",          icon: MapPin,       desc: "Manage multiple business locations",    group: "Business" },
  { id: "booking",       label: "Booking policies",   icon: Clock,        desc: "Notice, cancellations, advance limits", group: "Booking setup" },
  { id: "calendar",      label: "Calendar sync",      icon: CalendarDays, desc: "Sync bookings to Google Calendar",      group: "Booking setup" },
  { id: "online",        label: "Online booking",     icon: Globe,        desc: "Booking link, QR code, embed",          group: "Booking page" },
  { id: "branding",      label: "Branding",           icon: Palette,      desc: "Colors, fonts, booking page style",     group: "Booking page" },
  { id: "payments",      label: "Payments & fees",    icon: DollarSign,   desc: "Deposits, no-show fees",                group: "Payments" },
  { id: "payouts",       label: "Payouts",            icon: Banknote,     desc: "Connect bank account & withdraw",       group: "Payments" },
  { id: "billing",       label: "Billing & plan",     icon: CreditCard,   desc: "Subscription plan, upgrade",            group: "Payments" },
  { id: "notifications", label: "Notifications",      icon: Bell,         desc: "Emails & SMS sent to clients",          group: "Account" },
  { id: "security",      label: "Security",           icon: ShieldCheck,  desc: "Two-factor sign-in, password",          group: "Account" },
];

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function formatPolicyDuration(totalMinutes: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalMinutes) ? totalMinutes : 0));
  const days = Math.floor(safe / 1440);
  const hours = Math.floor((safe % 1440) / 60);
  const minutes = safe % 60;
  if (days > 0) return `${days} day${days === 1 ? "" : "s"}${hours ? ` ${hours} hr` : ""}${minutes ? ` ${minutes} min` : ""}`;
  if (hours > 0) return `${hours} hr${hours === 1 ? "" : "s"}${minutes ? ` ${minutes} min` : ""}`;
  return `${minutes} min`;
}

function PolicyNumberInput({ value, min = 0, unit, label, onChange }: {
  value: number; min?: number; unit: "hours" | "days"; label: string; onChange: (minutes: number) => void;
}) {
  const multiplier = unit === "days" ? 1440 : 60;
  const safe = Math.max(min, Math.floor(Number.isFinite(value) ? value : min));
  const displayValue = Math.max(min / multiplier, safe / multiplier);

  return (
    <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <Input
        type="number"
        min={min / multiplier}
        step={1}
        value={Number.isInteger(displayValue) ? displayValue : Number(displayValue.toFixed(1))}
        onChange={(e) => onChange(Math.max(min, Math.round((Number(e.target.value) || 0) * multiplier)))}
        aria-label={label}
        className="h-8 w-20 border-0 bg-transparent p-0 text-base font-semibold tabular-nums shadow-none focus-visible:ring-0"
      />
      <span className="ml-2 text-sm font-medium text-gray-500">{unit}</span>
    </div>
  );
}

function FeatureError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <p className="font-semibold text-red-800">Could not load this section completely.</p>
      <p className="mt-0.5 text-xs">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 text-xs font-semibold underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  );
}

// Owner-defined intake/consultation questions shown to clients at booking.
// Saved independently of the main settings form.
function IntakeFormEditor({ bizId, initial }: { bizId: string; initial: IntakeQuestion[] }) {
  const [questions, setQuestions] = useState<IntakeQuestion[]>(initial);
  const [saving, setSaving] = useState(false);

  const add = () => setQuestions((q) => [...q, { id: Math.random().toString(36).slice(2, 9), label: "", required: false }]);
  const update = (id: string, patch: Partial<IntakeQuestion>) => setQuestions((q) => q.map((x) => x.id === id ? { ...x, ...patch } : x));
  const remove = (id: string) => setQuestions((q) => q.filter((x) => x.id !== id));

  async function save() {
    const cleaned = questions.map((q) => ({ ...q, label: q.label.trim() })).filter((q) => q.label);
    if (cleaned.some((q) => q.label.length > 200)) { toast.error("Questions must be under 200 characters"); return; }
    setSaving(true);
    try {
      await api.business.update(bizId, { intakeQuestions: cleaned });
      setQuestions(cleaned);
      toast.success(cleaned.length ? "Intake form saved" : "Intake form cleared");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="w-4 h-4 text-violet-600" />
        <p className="text-sm font-semibold text-gray-800">Intake / consultation form</p>
      </div>
      <p className="text-xs text-gray-400 mb-3">Questions clients answer when they book online. Answers show on the appointment.</p>

      <div className="space-y-2">
        {questions.map((q, qi) => (
          <div key={q.id} className="flex items-center gap-2">
            <Input value={q.label} placeholder="e.g. Any allergies or sensitivities?"
              aria-label={`Question ${qi + 1}`}
              onChange={(e) => update(q.id, { label: e.target.value })} className="flex-1" />
            <button type="button" onClick={() => update(q.id, { required: !q.required })}
              role="switch"
              aria-checked={q.required}
              aria-label={`Question ${qi + 1} required`}
              className={cn("text-xs font-semibold px-2.5 py-2 rounded-lg border transition-colors shrink-0",
                q.required ? "border-violet-200 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-400 hover:bg-gray-50")}>
              Required
            </button>
            <button type="button" onClick={() => remove(q.id)}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0" aria-label="Remove question">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {questions.length === 0 && <p className="text-xs text-gray-400">No questions yet — add one below.</p>}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add question</Button>
        <Button type="button" size="sm" loading={saving} onClick={save}>Save form</Button>
      </div>
    </div>
  );
}

// ── WCAG contrast helpers ─────────────────────────────────────────────────────
function hexLuminance(hex: string): number {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return 0;
  const vals = [0, 2, 4].map(i => {
    const v = parseInt(raw.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2];
}
function wcagContrast(hex: string, against: string): number {
  const l1 = hexLuminance(hex);
  const l2 = hexLuminance(against);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
function contrastLabel(ratio: number): { pass: boolean; level: string; color: string } {
  if (ratio >= 7)   return { pass: true,  level: "AAA",    color: "text-emerald-700" };
  if (ratio >= 4.5) return { pass: true,  level: "AA",     color: "text-emerald-600" };
  if (ratio >= 3)   return { pass: false, level: "AA Large", color: "text-amber-600" };
  return              { pass: false, level: "Fail",   color: "text-red-600" };
}

function SettingsPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [biz, setBiz]       = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied]   = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [section, setSection] = useState<Section>("profile");
  const [form, setForm]       = useState<Partial<Business>>({});
  const [featureErrors, setFeatureErrors] = useState<Record<string, string>>({});

  const searchParams = useSearchParams();
  const router = useRouter();

  const bizId = user?.businessId ?? "";
  const isOwner = user?.role === "OWNER" || user?.role === "ADMIN";
  const visibleSections = useMemo(
    () => isOwner ? SECTIONS : SECTIONS.filter((s) => s.id === "security"),
    [isOwner],
  );

  const recordFeatureError = useCallback((key: string, error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    setFeatureErrors((prev) => ({ ...prev, [key]: message }));
  }, []);
  const clearFeatureError = useCallback((key: string) => {
    setFeatureErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // Sync section ↔ URL so refresh stays on the same tab.
  const goSection = useCallback((s: Section) => {
    setSection(s);
    router.replace(`/dashboard/settings?tab=${s}`, { scroll: false });
  }, [router]);

  // Two-factor: seeded from the live session, updated optimistically on toggle.
  const [twoFA, setTwoFA] = useState<boolean>(user?.twoFactorEnabled ?? false);
  const [twoFAMethod, setTwoFAMethod] = useState<"EMAIL" | "SMS">(user?.twoFactorMethod ?? "EMAIL");
  const [twoFASaving, setTwoFASaving] = useState(false);
  const [twoFAPassword, setTwoFAPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null); // shown once after enabling

  useEffect(() => {
    if (!user) return;
    setTwoFA(!!user.twoFactorEnabled);
    setTwoFAMethod(user.twoFactorMethod ?? "EMAIL");
  }, [user]);

  async function saveTwoFactor(enabled: boolean, method: "EMAIL" | "SMS") {
    if (!twoFAPassword) {
      toast.error("Enter your current password to change two-factor settings");
      return;
    }
    setTwoFASaving(true);
    const prev = { enabled: twoFA, method: twoFAMethod };
    setTwoFA(enabled); setTwoFAMethod(method);
    try {
      const res = await api.auth.setTwoFactor(enabled, method, twoFAPassword);
      if (res.user) {
        setTwoFA(!!res.user.twoFactorEnabled);
        setTwoFAMethod(res.user.twoFactorMethod ?? method);
      }
      if (res.recoveryCodes?.length) setRecoveryCodes(res.recoveryCodes);
      if (!enabled) setRecoveryCodes(null);
      setTwoFAPassword("");
      toast.success(enabled ? "Two-factor sign-in enabled" : "Two-factor sign-in turned off");
    } catch (err) {
      setTwoFA(prev.enabled); setTwoFAMethod(prev.method); // roll back
      toast.error(err instanceof Error ? err.message : "Could not update two-factor");
    } finally {
      setTwoFASaving(false);
    }
  }

  useEffect(() => {
    if (userLoading) return;
    if (!isOwner) {
      setSection("security");
      setLoading(false);
      return;
    }
    if (!bizId) {
      setLoadError("No business account is linked to your profile. Please contact support.");
      setLoading(false);
      return;
    }
    api.business.get(bizId)
      .then((b) => { setBiz(b); setForm({ ...b, phone: formatPhoneDisplay(b.phone) }); setDirty(false); })
      .catch((e) => { setLoadError(e instanceof Error ? e.message : "Failed to load settings"); setLoading(false); })
      .finally(() => setLoading(false));
  }, [bizId, isOwner, userLoading]);

  useEvents(
    bizId || null,
    useCallback(() => {}, []),
    useCallback((data: { plan: string; planExpiresAt: string | null }) => {
      setBiz((prev) => prev ? { ...prev, plan: data.plan as Business["plan"] } : prev);
      toast.success(`Plan updated to ${data.plan.charAt(0) + data.plan.slice(1).toLowerCase()}`);
    }, []),
  );

  const f = (k: keyof Business, v: unknown) => {
    setDirty(true);
    setForm((p) => ({ ...p, [k]: v }));
  };
  const bookingSettings = (form.bookingPageSettings ?? {}) as Record<string, unknown>;
  const notificationSettings = (form.notificationSettings ?? {}) as NonNullable<Business["notificationSettings"]>;
  const nf = (k: keyof NonNullable<Business["notificationSettings"]>, v: boolean) => {
    setDirty(true);
    setForm((p) => ({
      ...p,
      notificationSettings: { ...((p.notificationSettings ?? {}) as Record<string, unknown>), [k]: v },
    }));
  };
  const bf = (k: string, v: unknown) => {
    setDirty(true);
    setForm((p) => ({
      ...p,
      bookingPageSettings: { ...((p.bookingPageSettings ?? {}) as Record<string, unknown>), [k]: v },
    }));
  };

  const currentBrandColor = (form.bookingPageSettings as Record<string, unknown> | undefined)?.brandColor as string | undefined;
  useEffect(() => {
    const stored = currentBrandColor || "#7C3AED";
    setHexInputValue(/^#[0-9a-f]{6}$/i.test(stored) ? stored.replace('#', '') : "7C3AED");
  }, [currentBrandColor]);

  const [billingBusy, setBillingBusy] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [referralInput, setReferralInput] = useState("");
  const [myReferral, setMyReferral] = useState<{ code: string; referredCount: number } | null>(null);
  const [refCopied, setRefCopied] = useState(false);
  const [locationToRemove, setLocationToRemove] = useState<Location | null>(null);
  const [hexInputValue, setHexInputValue] = useState("");

  const loadSubscription = useCallback(async () => {
    try {
      const details = await api.subscriptions.get();
      setSubscription(details);
      clearFeatureError("subscription");
      return details;
    } catch (e) {
      recordFeatureError("subscription", e, "Could not load billing details");
      throw e;
    }
  }, [clearFeatureError, recordFeatureError]);

  useEffect(() => {
    if (bizId && isOwner) loadSubscription().catch(() => {});
  }, [bizId, isOwner, loadSubscription]);

  // Locations
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationForm, setLocationForm] = useState({ name: "", address: "", phone: "", timezone: "" });
  const [locationBusy, setLocationBusy] = useState(false);
  const loadLocations = useCallback(() => {
    if (!bizId || !isOwner) return;
    api.locations.list(bizId)
      .then((items) => { setLocations(items); clearFeatureError("locations"); })
      .catch((e) => recordFeatureError("locations", e, "Could not load locations"));
  }, [bizId, isOwner, clearFeatureError, recordFeatureError]);
  useEffect(() => { loadLocations(); }, [loadLocations]);

  // Stripe Connect / Payouts
  type ConnectStatus = { onboarded: boolean; chargesEnabled: boolean; accountId: string | null; available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] };
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectBusy, setConnectBusy] = useState<string | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const payoutIdempotencyKey = useRef<string | null>(null);
  const loadConnect = useCallback(() => {
    if (!isOwner) return;
    api.connect.status()
      .then((status) => { setConnectStatus(status); clearFeatureError("connect"); })
      .catch((e) => recordFeatureError("connect", e, "Could not load payout status"));
  }, [isOwner, clearFeatureError, recordFeatureError]);
  useEffect(() => { loadConnect(); }, [loadConnect]);

  // Load this business's own referral code + count.
  useEffect(() => {
    if (!isOwner) return;
    const savedReferral = searchParams.get("ref") ?? searchParams.get("referral") ?? localStorage.getItem("pulse_referral_code");
    if (savedReferral && /^PULSE-[A-Z0-9]{6}$/i.test(savedReferral)) {
      setReferralInput(savedReferral.toUpperCase());
    }
    api.referrals.get()
      .then((r) => { setMyReferral({ code: r.code, referredCount: r.referredCount }); clearFeatureError("referrals"); })
      .catch((e) => recordFeatureError("referrals", e, "Could not load referral details"));
  }, [isOwner, searchParams, clearFeatureError, recordFeatureError]);

  // Business verification status.
  const [verif, setVerif] = useState<{ status: VerificationStatus; note: string | null } | null>(null);
  const [verifBusy, setVerifBusy] = useState(false);
  const [verificationForm, setVerificationForm] = useState({
    legalName: "", address: "", phone: "", governmentIdUrl: "", registrationDocUrl: "",
  });
  useEffect(() => {
    if (!bizId || !isOwner) return;
    api.verification.status(bizId).then((v) => {
      setVerif({ status: v.verificationStatus, note: v.verificationNote });
      setVerificationForm({
        legalName: v.verificationLegalName ?? "",
        address: v.verificationAddress ?? "",
        phone: v.verificationPhone ?? "",
        governmentIdUrl: v.verificationGovernmentIdUrl ?? "",
        registrationDocUrl: v.verificationDocUrl ?? "",
      });
      clearFeatureError("verification");
    }).catch((e) => recordFeatureError("verification", e, "Could not load verification status"));
  }, [bizId, isOwner, clearFeatureError, recordFeatureError]);
  async function submitVerification() {
    if (!bizId) return;
    if (!verificationForm.legalName.trim() || !verificationForm.address.trim() || !verificationForm.phone.trim() || !verificationForm.governmentIdUrl || !verificationForm.registrationDocUrl) {
      toast.error("Complete every verification field and upload both documents");
      return;
    }
    setVerifBusy(true);
    try {
      const r = await api.verification.submit(bizId, verificationForm);
      setVerif({ status: r.verificationStatus, note: null });
      toast.success("Verification details submitted for review");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not submit"); }
    finally { setVerifBusy(false); }
  }

  // Google Calendar connection.
  const [cal, setCal] = useState<{ connected: boolean; email: string | null; configured: boolean } | null>(null);
  const loadCal = useCallback(() => {
    if (!isOwner) return;
    api.calendarSync.status()
      .then((status) => { setCal(status); clearFeatureError("calendar"); })
      .catch((e) => recordFeatureError("calendar", e, "Could not load calendar sync status"));
  }, [isOwner, clearFeatureError, recordFeatureError]);
  useEffect(() => { loadCal(); }, [loadCal]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("calendar");
    if (p === "connected") { toast.success("Google Calendar connected — bookings will sync automatically."); loadCal(); goSection("calendar"); }
    else if (p === "error") {
      const reason = params.get("reason") ?? "";
      const msg = reason.startsWith("google_denied") ? "Google Calendar access was denied. You can try again." : reason === "missing_code" ? "The connection was interrupted. Please try again." : `Could not connect Google Calendar${reason ? `: ${reason}` : ""}.`;
      toast.error(msg);
      goSection("calendar");
    }
  }, [goSection, loadCal]);
  async function connectCal() {
    try { const { url } = await api.calendarSync.connect(); window.location.assign(url); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not start Google connect"); }
  }
  async function disconnectCal() {
    try { await api.calendarSync.disconnect(); toast.success("Google Calendar disconnected"); loadCal(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not disconnect"); }
  }

  // Verify and reconcile a returning Stripe Checkout before claiming activation.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("billing");
    const sessionId = params.get("session_id");
    if (!result) return;

    window.history.replaceState({}, "", "/dashboard/settings?tab=billing");
    goSection("billing");
    if (result === "cancel") {
      toast.info("Checkout canceled");
      return;
    }
    if (result !== "success" || !sessionId || !bizId) {
      toast.error("Checkout returned without a valid subscription confirmation. No plan change was applied.");
      return;
    }

    let cancelled = false;
    setBillingBusy("confirming");
    const confirm = async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
        try {
          const confirmed = await api.subscriptions.confirmCheckout(sessionId);
          if (!confirmed.confirmed) throw new Error("Stripe is still completing checkout");
          const [business] = await Promise.all([api.business.get(bizId), loadSubscription()]);
          if (cancelled) return;
          setBiz(business);
          setForm({ ...business, phone: formatPhoneDisplay(business.phone) });
          toast.success(`Subscription active on ${confirmed.plan ?? business.plan}`);
          return;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      if (!cancelled) {
        toast.error(lastError instanceof Error ? lastError.message : "Subscription activation is still processing. Refresh Billing shortly.", { duration: 8000 });
      }
    };
    confirm().finally(() => { if (!cancelled) setBillingBusy(null); });
    return () => { cancelled = true; };
  }, [bizId, goSection, loadSubscription]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    // Also honour URL hash — e.g. #booking-policies → booking tab.
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    const hashToSection: Record<string, Section> = {
      "booking-policies": "booking",
      "booking": "booking",
      "payments": "payments",
      "payouts": "payouts",
      "notifications": "notifications",
      "security": "security",
      "billing": "billing",
      "online": "online",
      "branding": "branding",
      "calendar": "calendar",
      "locations": "locations",
      "profile": "profile",
    };
    const fromHash = hash ? hashToSection[hash] : undefined;
    const resolved = tab ?? fromHash;
    if (resolved && visibleSections.some((s) => s.id === resolved)) setSection(resolved as Section);
    else if (!visibleSections.some((s) => s.id === section)) setSection(visibleSections[0]?.id ?? "security");
  }, [searchParams, section, visibleSections]);

  useEffect(() => {
    const connect = searchParams.get("connect");
    if (connect === "success") {
      loadConnect();
      toast.success("Stripe account connected successfully — you can now accept payouts.");
      goSection("payouts");
    } else if (connect === "refresh") {
      // Auto-restart onboarding
      api.connect.onboard().then(({ url }) => window.location.assign(url)).catch((e) => toast.error(e instanceof Error ? e.message : "Could not resume Stripe onboarding"));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function upgrade(plan: "BASIC" | "PRO" | "UNLIMITED") {
    setBillingBusy(plan);
    trackEvent("checkout_start", {
      plan,
      billing_interval: billingInterval,
      has_referral_code: Boolean(referralInput.trim()),
    });
    try {
      const result = await api.subscriptions.checkout(plan, referralInput, billingInterval);
      if (result.url) {
        trackEvent("checkout_redirect", {
          plan,
          billing_interval: billingInterval,
          has_referral_code: Boolean(referralInput.trim()),
        });
        window.location.assign(result.url);
      }
      else {
        toast.success(`Switched to ${plan}. Stripe applied the prorated difference.`);
        trackEvent("subscription_plan_changed", { plan, billing_interval: billingInterval });
        if (bizId) Promise.all([api.business.get(bizId), loadSubscription()]).then(([b]) => { setBiz(b); setForm({ ...b, phone: formatPhoneDisplay(b.phone) }); }).catch(() => {});
        setBillingBusy(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start Stripe Checkout");
      setBillingBusy(null);
    }
  }

  async function manageBilling() {
    setBillingBusy("portal");
    try {
      const { url } = await api.subscriptions.portal();
      window.location.assign(url);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not open Stripe billing"); setBillingBusy(null); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!bizId || !isOwner) return;
    if (form.requireDeposit && !isPaid) {
      promptUpgrade("BASIC", "Mandatory deposits");
      return;
    }
    if (form.requireDeposit) {
      const pct = Number(form.depositPercent);
      if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
        toast.error("Deposit percentage must be between 1 and 100.");
        return;
      }
    }
    setSaving(true);
    try {
      const maxAdvanceMinutes = Number(form.maxAdvanceMinutes ?? ((form.maxAdvanceDays ?? 60) as number) * 1440);
      const cancellationWindowMinutes = Number(form.cancellationWindowMinutes ?? ((form.cancellationWindowHours ?? 24) as number) * 60);
      const payload: Partial<Business> = {
        name: String(form.name ?? "").trim(),
        slug: String(form.slug ?? "").trim(),
        email: String(form.email ?? "").trim().toLowerCase(),
        phone: String(form.phone ?? "").trim() || undefined,
        timezone: String(form.timezone ?? "America/New_York"),
        address: String(form.address ?? "").trim() || undefined,
        logoUrl: String(form.logoUrl ?? "").trim() || undefined,
        websiteUrl: String(form.websiteUrl ?? "").trim() || undefined,
        instagramUrl: String(form.instagramUrl ?? "").trim() || undefined,
        facebookUrl: String(form.facebookUrl ?? "").trim() || undefined,
        tiktokUrl: String(form.tiktokUrl ?? "").trim() || undefined,
        postVisitMessage: String(form.postVisitMessage ?? "").trim() || undefined,
        bookingPageSettings: bookingSettings,
        notificationSettings: (form.notificationSettings ?? {}) as Business["notificationSettings"],
        minNoticeMinutes: Number(form.minNoticeMinutes ?? 120),
        maxAdvanceMinutes,
        maxAdvanceDays: Math.max(1, Math.ceil(maxAdvanceMinutes / 1440)),
        cancellationWindowMinutes,
        cancellationWindowHours: Math.floor(cancellationWindowMinutes / 60),
        requireDeposit: !!form.requireDeposit,
        depositPercent: Math.max(1, Number(form.depositPercent ?? 25)),
        taxRatePercent: Math.max(0, Math.min(100, Number(form.taxRatePercent ?? 0))),
        noShowFeeCents: Math.max(0, Number(form.noShowFeeCents ?? 0)),
        cancellationFeeCents: Math.max(0, Number(form.cancellationFeeCents ?? 0)),
        collectCardOnFile: !!form.collectCardOnFile,
        currency: (form.currency as "CAD" | "USD") ?? "CAD",
        allowClientReschedule: form.allowClientReschedule !== false,
        allowClientCancel: form.allowClientCancel !== false,
        bookingApprovalMode: (form.bookingApprovalMode as "AUTO" | "MANUAL") ?? "MANUAL",
        cancellationPolicy: String(form.cancellationPolicy ?? "").trim() || undefined,
      };
      const updated = await api.business.update(bizId, payload);
      setBiz(updated);
      setForm({ ...updated, phone: formatPhoneDisplay(updated.phone) });
      setDirty(false);
      // If plan limits stripped a payment setting the user tried to enable, tell them.
      const planStripped =
        (payload.requireDeposit && !updated.requireDeposit) ||
        (payload.collectCardOnFile && !updated.collectCardOnFile);
      if (planStripped) {
        toast.error("Deposits and card-on-file require a Basic or Pro plan. Upgrade your plan to enable these features.", { duration: 6000 });
      } else {
        toast.success("Settings saved");
      }
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  function copyUrl() {
    navigator.clipboard.writeText(bookingUrl)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => toast.error("Could not copy link"));
  }

  if (userLoading || loading) return <LoadingSpinner />;
  if (loadError) return (
    <div className="text-center py-20">
      <p className="text-red-500 mb-3">{loadError}</p>
      <button onClick={() => { setLoadError(""); setLoading(true); api.business.get(bizId).then((b) => { setBiz(b); setForm({ ...b, phone: formatPhoneDisplay(b.phone) }); setDirty(false); }).catch((e) => { setLoadError(e instanceof Error ? e.message : "Failed to load settings"); }).finally(() => setLoading(false)); }} className="text-violet-600 hover:underline text-sm">Retry</button>
    </div>
  );

  const bookingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/book/${biz?.slug || biz?.id || ""}`;
  const embedOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const embedSnippet = `<script src="${embedOrigin}/embed.js" data-business-id="${biz?.id ?? ""}" async></script>`;
  const plan = biz?.plan ?? "FREE";
  // Development override only. Paid features remain gated unless the flag is
  // deliberately enabled at build time.
  const isPaid     = biz?.capabilities?.deposits      ?? (plan === "BASIC" || plan === "PRO" || plan === "UNLIMITED");
  const isPro      = biz?.capabilities?.sms           ?? (plan === "PRO"   || plan === "UNLIMITED");
  const isUnlimited = biz?.capabilities?.multipleLocations ?? (plan === "UNLIMITED");
  function promptUpgrade(target: "BASIC" | "PRO" | "UNLIMITED", feature: string) {
    const label = target === "BASIC" ? "Basic or higher" : target === "PRO" ? "Pro or higher" : "Unlimited";
    toast.info(`${feature} requires ${label}.`);
    goSection("billing");
  }
  function copyEmbed() {
    navigator.clipboard.writeText(embedSnippet)
      .then(() => { setEmbedCopied(true); setTimeout(() => setEmbedCopied(false), 2000); })
      .catch(() => toast.error("Could not copy snippet"));
  }

  return (
    <>
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          {isOwner ? "Manage your business profile and booking preferences" : "Manage your account security"}
        </p>
        {dirty && (
          <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            Unsaved changes
          </p>
        )}
      </div>

      {/* Duplicate account warning */}
      {biz?.suspectedDuplicateOfId && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Possible duplicate account detected</p>
            <p className="text-xs text-amber-700 mt-0.5">
              A business with a similar name and phone number already exists on Pulse. If this is intentional (e.g. a second location), please contact Pulse Admin to review. Opening multiple accounts with the same details may result in rejection.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-5">

        {/* Compact section picker — easier to scan than an 11-item horizontal tab strip. */}
        <div className="xl:hidden mb-4 relative -mx-3 sm:-mx-5">
          <div className="px-3 sm:px-5">
            <label htmlFor="settings-section" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Settings section
            </label>
            <select
              id="settings-section"
              value={section}
              onChange={(e) => goSection(e.target.value as Section)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {[...new Set(visibleSections.map((s) => s.group))].map((group) => (
                <optgroup key={group} label={group}>
                  {visibleSections.filter((s) => s.group === group).map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Left nav */}
        <aside className="hidden xl:block w-56 shrink-0">
          <nav className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {visibleSections.map(({ id, label, icon: Icon, desc, group }, i) => {
              const isGroupStart = i === 0 || visibleSections[i - 1].group !== group;
              return (
                <div key={id} className={cn(!isGroupStart && i !== 0 && "border-t border-gray-50")}>
                  {isGroupStart && i !== 0 && (
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{group}</p>
                    </div>
                  )}
                  <button onClick={() => goSection(id)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors group",
                      section === id ? "bg-violet-50" : "hover:bg-gray-50",
                    )}>
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 shrink-0",
                      section === id ? "bg-violet-100" : "bg-gray-100 group-hover:bg-gray-200")}>
                      <Icon className={cn("w-3.5 h-3.5", section === id ? "text-violet-600" : "text-gray-500")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", section === id ? "text-violet-700" : "text-gray-700")}>{label}</p>
                      <p className="text-xs text-gray-400 leading-tight mt-0.5 truncate">{desc}</p>
                    </div>
                    <ChevronRight className={cn("w-3 h-3 mt-1.5 shrink-0", section === id ? "text-violet-400" : "text-gray-300")} />
                  </button>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Right panel */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <form onSubmit={save}>

            {section === "profile" && (
              <div className="p-4 space-y-4 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Business profile</h3>
                  <p className="text-xs text-gray-600 mt-0.5">This information appears on your booking page.</p>
                </div>
                <FeatureError
                  message={featureErrors.verification}
                  onRetry={() => bizId && api.verification.status(bizId).then((v) => {
                    setVerif({ status: v.verificationStatus, note: v.verificationNote });
                    setVerificationForm({
                      legalName: v.verificationLegalName ?? "",
                      address: v.verificationAddress ?? "",
                      phone: v.verificationPhone ?? "",
                      governmentIdUrl: v.verificationGovernmentIdUrl ?? "",
                      registrationDocUrl: v.verificationDocUrl ?? "",
                    });
                    clearFeatureError("verification");
                  }).catch((e) => recordFeatureError("verification", e, "Could not load verification status"))}
                />
                <hr className="border-gray-100" />

                {/* Business verification */}
                {verif && verif.status === "VERIFIED" ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-sm font-medium text-emerald-800">Business verified</p>
                  </div>
                ) : verif ? (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-5 h-5 text-violet-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-violet-900">Verify your business</p>
                        {verif.status === "PENDING" ? (
                          <p className="text-xs text-violet-700 mt-1">Your document is under review — we&apos;ll let you know once it&apos;s approved.</p>
                        ) : (
                          <>
                            <p className="text-xs text-violet-700 mt-1">
                              Provide your business details and documents the review team needs before requesting verification.
                              {verif.status === "REJECTED" && verif.note ? ` Previous submission declined: ${verif.note}` : ""}
                            </p>
                            <div className={cn("mt-3 space-y-3", verifBusy && "opacity-60 pointer-events-none")}>
                              <Input aria-label="Full business legal name" placeholder="Full business name" value={verificationForm.legalName} onChange={(e) => setVerificationForm((p) => ({ ...p, legalName:e.target.value }))} />
                              <Input aria-label="Business address" placeholder="Business address" value={verificationForm.address} onChange={(e) => setVerificationForm((p) => ({ ...p, address:e.target.value }))} />
                              <Input aria-label="Business phone number for verification" placeholder="Phone number" type="tel" value={verificationForm.phone} onChange={(e) => setVerificationForm((p) => ({ ...p, phone:e.target.value }))} />
                              <div>
                                <p className="text-xs font-medium text-violet-700 mb-1.5">Government-issued ID</p>
                                <ImageUpload value={verificationForm.governmentIdUrl || null} documents onChange={(url) => setVerificationForm((p) => ({ ...p, governmentIdUrl:url ?? "" }))} />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-violet-700 mb-1.5">Business registration</p>
                                <ImageUpload value={verificationForm.registrationDocUrl || null} documents onChange={(url) => setVerificationForm((p) => ({ ...p, registrationDocUrl:url ?? "" }))} />
                              </div>
                              <button
                                type="button"
                                onClick={() => submitVerification()}
                                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                                <ShieldCheck className="w-4 h-4" /> Submit for verification
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                <Field label="Logo">
                  <ImageUpload value={(form.logoUrl as string) ?? null} kind="LOGO" onChange={async (url) => {
                    setForm((p) => ({ ...p, logoUrl: url ?? "" }));
                    // Persist the logo on its own so it can't be lost to an unrelated
                    // invalid field elsewhere in the settings form.
                    if (!bizId) return;
                    try { await api.business.update(bizId, { logoUrl: url ?? "" }); toast.success(url ? "Logo saved" : "Logo removed"); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save logo"); }
                  }} />
                </Field>
                <Field label="Business name" htmlFor="set-name">
                  <Input id="set-name" value={(form.name as string) ?? ""} onChange={(e) => f("name", e.target.value)} placeholder="e.g. Paws & Claws Grooming" />
                </Field>
                <Field label="Contact email" htmlFor="set-email">
                  <Input id="set-email" type="email" value={(form.email as string) ?? ""} onChange={(e) => f("email", e.target.value)} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Phone" htmlFor="set-phone">
                    <Input id="set-phone" type="tel" placeholder="+1 (416) 555-0123" value={(form.phone as string) ?? ""} onChange={(e) => f("phone", formatPhoneInput(e.target.value))} />
                  </Field>
                  <Field label="Timezone" htmlFor="biz-timezone">
                    <select id="biz-timezone" value={(form.timezone as string) ?? "America/New_York"} onChange={(e) => f("timezone", e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Address" htmlFor="set-address">
                    <Input id="set-address" value={(form.address as string) ?? ""} onChange={(e) => f("address", e.target.value)} placeholder="123 Main St, City, State" />
                  </Field>
                  <Field label="Currency" htmlFor="biz-currency">
                    <select id="biz-currency" value={(form.currency as string) ?? "CAD"} onChange={(e) => f("currency", e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                      <option value="CAD">CAD — Canadian dollar (CA$)</option>
                      <option value="USD">USD — US dollar ($)</option>
                    </select>
                  </Field>
                </div>
                <div className="rounded-xl border border-gray-100 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Post-visit and social links</p>
                    <p className="text-xs text-gray-400">Shown after an appointment closes. Only secure https:// links are accepted.</p>
                  </div>
                  <Field label="Thank-you message" htmlFor="set-post-visit">
                    <Input id="set-post-visit" value={(form.postVisitMessage as string) ?? ""} onChange={(e) => f("postVisitMessage", e.target.value)} placeholder="Thanks for visiting. We hope to see you again soon." />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["websiteUrl", "instagramUrl", "facebookUrl", "tiktokUrl"] as const).map((key) => {
                      const LABELS: Record<string, string> = { websiteUrl: "Website", instagramUrl: "Instagram", facebookUrl: "Facebook", tiktokUrl: "TikTok" };
                      return (
                        <Field key={key} htmlFor={`set-${key}`} label={LABELS[key]}>
                          <Input id={`set-${key}`} type="url" value={(form[key] as string) ?? ""} onChange={(e) => f(key, e.target.value)} placeholder="https://" />
                        </Field>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {section === "booking" && (
              <div className="p-4 space-y-5 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Booking policies</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Set the client booking rules that protect your calendar.</p>
                </div>
                <Link
                  href="/dashboard/hours"
                  className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors"
                >
                  <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-900">Business hours</p>
                    <p className="text-xs text-amber-700 mt-0.5">Set the days and times you&apos;re open. Clients can only book within these hours.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />
                </Link>
                <hr className="border-gray-100" />

                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                  {[
                    {
                      label: "Minimum booking notice",
                      desc: "Clients must book at least this far before the appointment starts.",
                      value: (form.minNoticeMinutes as number) ?? 120,
                      min: 60,
                      unit: "hours" as const,
                      key: "minNoticeMinutes" as const,
                    },
                    {
                      label: "Booking opens up to",
                      desc: "The farthest date clients can choose on your booking page.",
                      value: (form.maxAdvanceMinutes as number) ?? (((form.maxAdvanceDays as number) ?? 60) * 1440),
                      min: 7 * 1440,
                      unit: "days" as const,
                      key: "maxAdvanceMinutes" as const,
                    },
                    {
                      label: "Cancel / reschedule cutoff",
                      desc: "How many hours before the appointment clients can still change it themselves.",
                      value: (form.cancellationWindowMinutes as number) ?? (((form.cancellationWindowHours as number) ?? 24) * 60),
                      min: 0,
                      unit: "hours" as const,
                      key: "cancellationWindowMinutes" as const,
                    },
                  ].map((item) => (
                    <div key={item.key} className="grid gap-3 border-b border-gray-100 p-4 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500">{item.desc}</p>
                      </div>
                      <div className="sm:text-right">
                        <PolicyNumberInput value={item.value} min={item.min} unit={item.unit} label={item.label} onChange={(minutes) => f(item.key, minutes)} />
                        <p className="mt-1 text-xs text-gray-400">Currently {formatPolicyDuration(item.value)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900">Cancellation rule</p>
                  <p className="mt-1 text-xs leading-relaxed text-blue-700">
                    Clients can cancel for free until the cancel window begins. Inside that window, Basic+ businesses can collect deposits and charge manually; Pro can add automatic late-cancellation fees when a saved card is available.
                  </p>
                </div>

                <Field label="Policy clients accept before booking" htmlFor="set-cancel-policy">
                  <textarea
                    id="set-cancel-policy"
                    className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-violet-200"
                    value={(form.cancellationPolicy as string) ?? ""}
                    onChange={(e) => f("cancellationPolicy", e.target.value)}
                    placeholder="Appointments cancelled within 24 hours of the scheduled time may be subject to a cancellation fee…" />
                  <p className="text-xs text-gray-400 mt-1">Shown during checkout on every business-specific booking link.</p>
                </Field>

                <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Client self-reschedule</p>
                    <p className="text-xs text-gray-400 mt-0.5">Clients can move appointments from their secure manage link when outside your policy window.</p>
                  </div>
                  <button type="button" onClick={() => f("allowClientReschedule", !form.allowClientReschedule)}
                    role="switch"
                    aria-checked={form.allowClientReschedule !== false}
                    aria-label="Toggle client self-reschedule"
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.allowClientReschedule ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.allowClientReschedule ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Client self-cancel</p>
                    <p className="text-xs text-gray-400 mt-0.5">Clients can cancel appointments from their secure manage link. Cancellations inside your window still trigger the late-cancel fee if configured.</p>
                  </div>
                  <button type="button" onClick={() => f("allowClientCancel", form.allowClientCancel === false ? true : false)}
                    role="switch"
                    aria-checked={form.allowClientCancel !== false}
                    aria-label="Toggle client self-cancel"
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.allowClientCancel !== false ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.allowClientCancel !== false ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Booking approval mode</p>
                    <p className="text-xs text-gray-400 mt-0.5">Auto-confirm sends an instant confirmation when a client books. Manual approval puts bookings in a pending queue for you to review first.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500">{form.bookingApprovalMode === "AUTO" ? "Auto-confirm" : "Manual approval"}</span>
                    <button type="button"
                      onClick={() => f("bookingApprovalMode", form.bookingApprovalMode === "AUTO" ? "MANUAL" : "AUTO")}
                      role="switch"
                      aria-checked={form.bookingApprovalMode === "AUTO"}
                      aria-label="Toggle booking approval mode"
                      className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.bookingApprovalMode === "AUTO" ? "bg-violet-600" : "bg-gray-200")}>
                      <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.bookingApprovalMode === "AUTO" ? "translate-x-6" : "translate-x-1")} />
                    </button>
                  </div>
                </div>

                {bizId && <IntakeFormEditor bizId={bizId} initial={(biz?.intakeQuestions as IntakeQuestion[] | undefined) ?? []} />}

                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-violet-600" />
                    <p className="text-sm font-semibold text-gray-800">Sales tax</p>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">Shown on booking totals and receipts. Set to 0 to hide tax.</p>
                  <div className="flex items-center gap-2 max-w-[180px]">
                    <Input type="number" min={0} max={100} step={0.01}
                      aria-label="Sales tax rate"
                      value={(form.taxRatePercent as number) ?? 0}
                      onChange={(e) => f("taxRatePercent", Number(e.target.value))}
                      className="bg-white text-base font-semibold" />
                    <span className="text-sm font-medium text-gray-500">% tax</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">Saved when you click Save changes below.</p>
                </div>
              </div>
            )}

            {section === "calendar" && (
              <div className="p-4 space-y-5 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Calendar sync</h3>
                  <p className="text-xs text-gray-400 mt-0.5">See your Pulse appointments in any calendar app on your phone or computer.</p>
                </div>
                <FeatureError message={featureErrors.calendar} onRetry={loadCal} />

                {/* ── iCal feed (primary, beginner-friendly) ───────────────── */}
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex w-9 h-9 rounded-lg bg-amber-100 items-center justify-center shrink-0">
                      <Download className="w-4 h-4 text-amber-700" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-amber-900">iCal feed — works with every calendar app</p>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        Download or subscribe to your appointments in <strong>Google Calendar, Apple Calendar, Outlook</strong>, or any app on your phone or computer. No scary screens, no special setup — just one click.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={api.calendarSync.icalFeedUrl()}
                      download="pulse-appointments.ics"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download .ics file
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}${api.calendarSync.icalFeedUrl()}`;
                        navigator.clipboard.writeText(url).then(() => toast.success("Feed link copied — paste it into Google Calendar → Other calendars → From URL")).catch(() => toast.error("Could not copy"));
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-amber-400 text-amber-800 text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      Copy link
                    </button>
                  </div>

                  {/* Step-by-step for beginners */}
                  <div className="rounded-lg bg-white/70 border border-amber-100 p-4 space-y-3 text-xs text-amber-900">
                    <p className="font-semibold text-amber-800">How to add to your calendar:</p>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold">📱 iPhone / Apple Calendar</p>
                        <p className="text-amber-700 mt-0.5">Download the .ics file → tap &quot;Add to Calendar&quot; when prompted.</p>
                      </div>
                      <div>
                        <p className="font-semibold">🗓 Google Calendar</p>
                        <p className="text-amber-700 mt-0.5">Copy the link above → open Google Calendar → click <strong>&quot;+&quot;</strong> next to &quot;Other calendars&quot; → <strong>&quot;From URL&quot;</strong> → paste the link → click &quot;Add calendar&quot;.</p>
                      </div>
                      <div>
                        <p className="font-semibold">💻 Outlook</p>
                        <p className="text-amber-700 mt-0.5">Download the .ics file → open Outlook → File → Open &amp; Export → Import/Export → Import an iCalendar file.</p>
                      </div>
                    </div>
                    <p className="text-amber-600 italic">Tip: confirmation emails sent to your clients also include a calendar invite they can add in one tap.</p>
                  </div>
                </div>

                {/* ── Google Calendar two-way sync (advanced) ──────────────── */}
                {cal?.configured && (
                  <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-violet-500" />
                      <p className="text-sm font-semibold text-gray-900">Google Calendar — two-way sync</p>
                      <span className="ml-auto text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">Advanced</span>
                    </div>
                    {cal.connected ? (
                      <>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Connected as <strong>{cal.email}</strong>. Confirmed bookings sync automatically to your Google Calendar, and your personal Google Calendar events block those time slots from new bookings.
                        </p>
                        <button type="button" onClick={disconnectCal}
                          className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors">Disconnect</button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Connect your Google account for automatic two-way sync. Google will show a &quot;This app isn&apos;t verified&quot; warning — this is normal for apps awaiting Google review. Click <strong>Advanced → Go to pulseappointments.com</strong> to continue.
                        </p>
                        <button type="button" onClick={connectCal}
                          className="text-xs font-semibold text-white bg-violet-600 rounded-lg px-3 py-2 hover:bg-violet-700 transition-colors">Connect Google Calendar</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {section === "payments" && (
              <div className="p-4 space-y-4 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Payments &amp; fees</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Deposits and manual charges are Basic+. Automatic saved-card fees are Pro.</p>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-900">Stripe payments</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md">Deposits, saved cards, fees, refunds, receipts, and subscription billing are processed securely by Stripe. Card details never pass through Pulse servers.</p>
                </div>

                <hr className="border-gray-100" />
                {isPaid && (
                  <p className="text-xs text-gray-400 -mt-1">Enable the toggles below, then click <span className="font-semibold text-gray-600">Save changes</span> at the bottom of this page.</p>
                )}
                {!isPaid && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <p className="font-semibold">Payments require Basic+</p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-700">Free can book appointments and send confirmations. Basic adds deposits and manual charges. Pro adds automatic saved-card fee protection.</p>
                    <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => promptUpgrade("BASIC", "Payments")}>View plans</button>
                  </div>
                )}
                {isPaid && !isPro && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                    <p className="font-semibold">Basic payment tools are active</p>
                    <p className="mt-1 text-xs leading-relaxed text-blue-700">You can collect deposits at booking and take manual charges. Upgrade to Pro for automatic no-show and late-cancellation charges.</p>
                  </div>
                )}
                <div className={cn("flex flex-col gap-3 p-4 rounded-xl border sm:flex-row sm:items-center sm:justify-between", isPaid ? "border-gray-100 bg-gray-50" : "border-gray-100 bg-gray-50")}>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Require deposit at booking</p>
                    <p className="text-xs text-gray-400 mt-0.5">Collect a partial payment when clients book online. Basic+</p>
                  </div>
                  <button type="button" onClick={() => isPaid ? f("requireDeposit", !form.requireDeposit) : promptUpgrade("BASIC", "Deposits")}
                    role="switch"
                    aria-checked={!!form.requireDeposit}
                    aria-label="Toggle require deposit at booking"
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.requireDeposit ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.requireDeposit ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>
                {isPaid && form.requireDeposit && (
                  <Field label="Deposit percentage" htmlFor="set-deposit-pct">
                    <div className="flex items-center gap-2">
                      <Input id="set-deposit-pct" type="number" min={1} max={100} value={(form.depositPercent as number) ?? 25}
                        onChange={(e) => f("depositPercent", Number(e.target.value))} />
                      <span className="text-sm text-gray-500 shrink-0">%</span>
                    </div>
                  </Field>
                )}

                <div className="flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="pr-3">
                    <p className="text-sm font-semibold text-gray-800">Collect a card on file</p>
                    <p className="text-xs text-gray-400 mt-0.5">Ask every client to save a card with Stripe at booking (no upfront charge) so you can collect deposits/no-show/late-cancel fees later. Basic+</p>
                  </div>
                  <button type="button" onClick={() => isPaid ? f("collectCardOnFile", !form.collectCardOnFile) : promptUpgrade("BASIC", "Card on file")}
                    role="switch"
                    aria-checked={!!form.collectCardOnFile}
                    aria-label="Toggle collect a card on file"
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.collectCardOnFile ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.collectCardOnFile ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={cn("rounded-xl border border-gray-100 bg-gray-50 p-4", !isPro && "opacity-85")}>
                    <Field label="No-show fee" htmlFor="set-noshowfee">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 shrink-0">$</span>
                        <Input id="set-noshowfee" type="number" min={0} step="0.01" disabled={!isPro} onFocus={() => !isPro && promptUpgrade("PRO", "Automatic no-show fees")}
                          value={(((form.noShowFeeCents as number) ?? 0) / 100).toString()}
                          onChange={(e) => f("noShowFeeCents", Math.round(Number(e.target.value) * 100))} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Pro automatic charge. Basic+ can still charge manually from checkout.</p>
                      {!isPro && <button type="button" onClick={() => promptUpgrade("PRO", "Automatic no-show fees")} className="mt-2 text-xs font-semibold text-violet-600 hover:underline">Upgrade to unlock</button>}
                    </Field>
                  </div>
                  <div className={cn("rounded-xl border border-gray-100 bg-gray-50 p-4", !isPro && "opacity-85")}>
                    <Field label="Late-cancellation fee" htmlFor="set-latefee">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 shrink-0">$</span>
                        <Input id="set-latefee" type="number" min={0} step="0.01" disabled={!isPro} onFocus={() => !isPro && promptUpgrade("PRO", "Automatic late-cancellation fees")}
                          value={(((form.cancellationFeeCents as number) ?? 0) / 100).toString()}
                          onChange={(e) => f("cancellationFeeCents", Math.round(Number(e.target.value) * 100))} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Pro automatic charge when a client cancels inside your window.</p>
                      {!isPro && <button type="button" onClick={() => promptUpgrade("PRO", "Automatic late-cancellation fees")} className="mt-2 text-xs font-semibold text-violet-600 hover:underline">Upgrade to unlock</button>}
                    </Field>
                  </div>
                </div>
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Manual charges</p>
                    <p className="text-xs text-gray-400 mt-0.5">Basic+ businesses can charge a client manually from checkout for fees, balances, or add-ons.</p>
                  </div>
                  <span className={cn("shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full", isPaid ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500")}>
                    {isPaid ? "Available" : "Basic+"}
                  </span>
                </div>
              </div>
            )}

            {section === "online" && (
              <div className="p-4 space-y-5 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Online booking</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Share your booking link with clients.</p>
                </div>
                <hr className="border-gray-100" />
                <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-violet-600" />
                    <span className="text-sm font-semibold text-violet-700">Your secure booking page</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-violet-200 rounded-xl px-4 py-3">
                    <code className="text-sm text-violet-600 flex-1 truncate">{bookingUrl}</code>
                    <button type="button" onClick={copyUrl} aria-label="Copy booking URL" className="text-gray-400 hover:text-violet-600 transition-colors shrink-0">
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-violet-500 mt-2">Share this link anywhere clients can find you.</p>

                  {/* Social share row */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Book an appointment with me: ${bookingUrl}`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                    >
                      WhatsApp
                    </a>
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(bookingUrl)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1877F2] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Facebook
                    </a>
                    <a
                      href={`mailto:?subject=Book an appointment&body=You can book an appointment with me here: ${bookingUrl}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Email
                    </a>
                  </div>

                  {/* Bio page link */}
                  {biz?.slug && (
                    <div className="mt-3 rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 text-xs text-violet-800">
                      <span className="font-semibold">Mobile bio page:</span> Share{" "}
                      <code className="font-mono">{typeof window !== "undefined" ? window.location.origin : ""}/bio/{biz.slug}</code>{" "}
                      — a clean mobile link page with your services, social links, and a Book Now button. Perfect for Instagram and TikTok bios.
                    </div>
                  )}

                  {/* Instagram tip */}
                  <div className="mt-2 rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 text-xs text-purple-800">
                    <span className="font-semibold">Instagram:</span> Go to your profile → <strong>Edit profile</strong> → paste your booking link (or bio page link) in the <strong>Website</strong> field. Clients can tap it directly from your bio.
                  </div>
                  <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
                    <span className="font-semibold">Google Business:</span> Go to your Google Business Profile → <strong>Edit profile</strong> → <strong>Website</strong> → paste your link so clients who find you on Google can book instantly.
                  </div>
                  <div className="mt-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-xs text-green-800">
                    <span className="font-semibold">Facebook Page:</span> Go to your Page → <strong>Edit</strong> → <strong>Add a Button</strong> → choose <strong>Book Now</strong> → paste your booking link.
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <QrCode className="w-4 h-4 text-gray-700" />
                    <span className="text-sm font-semibold text-gray-900">QR code</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Print and display in your shop, on flyers, or business cards so walk-in clients can scan to book instantly.</p>
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-gray-200 inline-block" id="booking-qr">
                      <QRCode value={bookingUrl} size={160} />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const svg = document.querySelector("#booking-qr svg");
                        if (!svg) return;
                        const data = new XMLSerializer().serializeToString(svg);
                        const blob = new Blob([data], { type: "image/svg+xml" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = "booking-qr.svg"; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-1.5 text-sm text-violet-600 hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" /> Download SVG
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Braces className="w-4 h-4 text-gray-700" />
                    <span className="text-sm font-semibold text-gray-900">Embed on your website</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">Paste this snippet into your site&apos;s HTML to embed the booking widget. It uses your public business ID instead of an email-derived slug.</p>
                  <div className="flex items-start gap-2 bg-gray-900 rounded-xl px-4 py-3">
                    <code className="text-xs text-gray-100 flex-1 break-all font-mono">{embedSnippet}</code>
                    <button type="button" onClick={copyEmbed} aria-label="Copy embed snippet" className="text-gray-400 hover:text-white transition-colors shrink-0 mt-0.5">
                      {embedCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick stats</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Public booking ID</span>
                    <code className="text-gray-800 font-medium">{biz?.id}</code>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Timezone</span>
                    <span className="text-gray-800 font-medium">{biz?.timezone}</span>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Booking page builder</h4>
                      <p className="text-xs text-gray-400">Tune public page copy and SEO from the web dashboard.</p>
                    </div>
                    <Field label="Hero headline" htmlFor="set-headline">
                      <Input id="set-headline" value={(bookingSettings.headline as string) ?? ""} onChange={(e) => bf("headline", e.target.value)} placeholder={`Book with ${biz?.name ?? "us"}`} />
                    </Field>
                    <Field label="Short introduction" htmlFor="set-intro">
                      <textarea
                        id="set-intro"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-violet-200"
                        value={(bookingSettings.intro as string) ?? ""}
                        onChange={(e) => bf("intro", e.target.value)}
                        placeholder="Tell clients what to expect before they book." />
                    </Field>
                    <Field label="SEO title" htmlFor="set-seo-title">
                      <Input id="set-seo-title" value={(bookingSettings.seoTitle as string) ?? ""} onChange={(e) => bf("seoTitle", e.target.value)} placeholder={`${biz?.name ?? "Business"} booking`} />
                    </Field>
                    <p className="text-xs text-gray-400">To change your brand colour and font, go to <button type="button" onClick={() => goSection("branding")} className="text-violet-600 hover:underline font-medium">Branding</button>.</p>
                    <Field label="SEO description" htmlFor="set-seo-desc">
                      <Input id="set-seo-desc" value={(bookingSettings.seoDescription as string) ?? ""} onChange={(e) => bf("seoDescription", e.target.value)} placeholder="Book appointments online." />
                    </Field>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Live preview</p>
                    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: String(bookingSettings.brandColor ?? "#7C3AED") }} />
                      <h4 className="mt-4 text-base font-bold text-gray-900">{String(bookingSettings.headline || `Book with ${biz?.name ?? "us"}`)}</h4>
                      <p className="mt-2 text-xs leading-relaxed text-gray-500">{String(bookingSettings.intro || biz?.cancellationPolicy || "Choose a service, pick a time, and confirm your appointment.")}</p>
                      <div className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700">Services and availability appear below</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === "branding" && (() => {
              const storedBrandHex = (bookingSettings.brandColor as string) || "#7C3AED";
              const brandHex = /^#[0-9a-f]{6}$/i.test(storedBrandHex) ? storedBrandHex : "#7C3AED";
              const onWhite = wcagContrast(brandHex, "#ffffff");
              const onBlack = wcagContrast(brandHex, "#1f2937");
              const whiteText = wcagContrast("#ffffff", brandHex);
              const blackText = wcagContrast("#1f2937", brandHex);
              const bestText  = blackText > whiteText ? "#1f2937" : "#ffffff";
              const wLabel    = contrastLabel(onWhite);
              const bLabel    = contrastLabel(onBlack);
              const btnLabel  = contrastLabel(Math.max(whiteText, blackText));
              const FONTS = [
                { id: "default",  label: "Default",  style: "font-sans",   preview: "Aa" },
                { id: "modern",   label: "Modern",   style: "font-sans tracking-tight", preview: "Aa" },
                { id: "elegant",  label: "Elegant",  style: "font-serif",  preview: "Aa" },
                { id: "bold",     label: "Bold",     style: "font-sans font-black", preview: "Aa" },
              ] as const;
              const fontVal = (bookingSettings.fontFamily as string) || "default";
              const COLOR_FAMILIES = [
                { name: "Red", shades: ["#7F1D1D", "#B91C1C", "#DC2626", "#EF4444", "#FCA5A5"] },
                { name: "Rose", shades: ["#881337", "#BE123C", "#E11D48", "#F43F5E", "#FDA4AF"] },
                { name: "Orange", shades: ["#7C2D12", "#C2410C", "#EA580C", "#F97316", "#FDBA74"] },
                { name: "Amber", shades: ["#78350F", "#B45309", "#D97706", "#F59E0B", "#FCD34D"] },
                { name: "Emerald", shades: ["#064E3B", "#047857", "#059669", "#10B981", "#6EE7B7"] },
                { name: "Teal", shades: ["#134E4A", "#0F766E", "#0D9488", "#14B8A6", "#5EEAD4"] },
                { name: "Blue", shades: ["#1E3A8A", "#1D4ED8", "#2563EB", "#3B82F6", "#93C5FD"] },
                { name: "Violet", shades: ["#4C1D95", "#6D28D9", "#7C3AED", "#8B5CF6", "#C4B5FD"] },
                { name: "Fuchsia", shades: ["#701A75", "#A21CAF", "#C026D3", "#D946EF", "#F0ABFC"] },
                { name: "Slate", shades: ["#0F172A", "#334155", "#475569", "#64748B", "#94A3B8"] },
              ] as const;
              return (
                <div className="p-4 space-y-6 sm:p-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Branding</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Customise how your booking page looks to clients. Changes apply after you save.</p>
                  </div>
                  <hr className="border-gray-100" />

                  {/* Brand color + WCAG checker */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Palette className="w-4 h-4 text-violet-500" /> Brand colour</p>
                      <p className="text-xs text-gray-400 mt-0.5">Used for buttons, highlights, and accents on your booking page. Accessible to all plans.</p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Native colour picker — opens OS colour wheel */}
                      <label className="relative cursor-pointer group">
                        <div className="w-12 h-12 rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden group-hover:border-violet-400 transition-colors"
                          style={{ backgroundColor: brandHex }} />
                        <input type="color" value={brandHex} onChange={(e) => bf("brandColor", e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" aria-label="Pick brand colour" />
                      </label>

                      {/* Hex text input */}
                      <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 bg-white">
                        <span className="text-sm text-gray-400 font-mono">#</span>
                        <input
                          type="text"
                          maxLength={6}
                          aria-label="Hex colour code"
                          value={hexInputValue}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                            setHexInputValue(v);
                            if (v.length === 6) bf("brandColor", `#${v}`);
                          }}
                          className="w-20 text-sm font-mono text-gray-800 bg-transparent focus:outline-none uppercase" />
                      </div>

                      {/* Live button preview */}
                      <button type="button" className="px-4 py-2 rounded-xl text-sm font-semibold shadow-sm"
                        style={{ backgroundColor: brandHex, color: bestText }}>
                        Book now
                      </button>
                    </div>

                    {/* WCAG Accessibility panel */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" /> Accessibility — WCAG contrast ratios
                      </p>
                      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-lg bg-white border border-gray-100 p-2.5 text-center">
                          <p className="text-gray-400 mb-1">Colour on white</p>
                          <p className="font-bold text-gray-900 tabular-nums">{onWhite.toFixed(1)}:1</p>
                          <span className={cn("text-[10px] font-semibold", wLabel.color)}>{wLabel.level}</span>
                        </div>
                        <div className="rounded-lg bg-white border border-gray-100 p-2.5 text-center">
                          <p className="text-gray-400 mb-1">Colour on dark</p>
                          <p className="font-bold text-gray-900 tabular-nums">{onBlack.toFixed(1)}:1</p>
                          <span className={cn("text-[10px] font-semibold", bLabel.color)}>{bLabel.level}</span>
                        </div>
                        <div className="rounded-lg border border-gray-100 p-2.5 text-center"
                          style={{ backgroundColor: brandHex, color: bestText }}>
                          <p className="opacity-70 mb-1 text-[10px]">Text on button</p>
                          <p className="font-bold tabular-nums text-xs">{Math.max(whiteText, blackText).toFixed(1)}:1</p>
                          <span className="text-[10px] font-semibold opacity-90">{btnLabel.level}</span>
                        </div>
                      </div>
                      {!btnLabel.pass && (
                        <p className="text-[11px] text-amber-700 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          This colour may be hard for some clients to read. WCAG AA requires 4.5:1 for normal text. Try a darker or lighter shade.
                        </p>
                      )}
                      {btnLabel.pass && (
                        <p className="text-[11px] text-emerald-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          Good contrast — this colour meets WCAG {btnLabel.level} accessibility standards.
                        </p>
                      )}
                    </div>

                    {/* Colour palette shades */}
                    <div>
                      <p className="text-xs font-medium text-gray-600">Colour shades</p>
                      <p className="mb-3 mt-0.5 text-[11px] text-gray-400">Choose a prepared shade or use the picker above for any colour.</p>
                      <div className="space-y-2.5">
                        {COLOR_FAMILIES.map((family) => (
                          <div key={family.name} className="grid grid-cols-[64px_1fr] items-center gap-2">
                            <span className="text-[11px] font-medium text-gray-500">{family.name}</span>
                            <div className="grid grid-cols-5 gap-1.5">
                              {family.shades.map((hex, shadeIndex) => (
                                <button key={hex} type="button" title={`${family.name} shade ${shadeIndex + 1} — ${hex}`}
                                  onClick={() => bf("brandColor", hex)}
                                  className={cn("h-8 rounded-lg border-2 shadow-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-violet-300",
                                    brandHex.toLowerCase() === hex.toLowerCase() ? "border-gray-950 scale-105" : "border-white")}
                                  style={{ backgroundColor: hex }}
                                  aria-label={`${family.name} shade ${shadeIndex + 1}, ${hex}`} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* Tagline */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-800">Tagline</p>
                    <p className="text-xs text-gray-400">A short phrase shown below your business name on the booking page. All plans.</p>
                    <input
                      type="text"
                      maxLength={80}
                      aria-label="Tagline"
                      value={(bookingSettings.tagline as string) ?? ""}
                      onChange={(e) => bf("tagline", e.target.value)}
                      placeholder="e.g. Premium care, every visit."
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200" />
                    <p className="text-[11px] text-gray-400 text-right">{((bookingSettings.tagline as string) ?? "").length}/80</p>
                  </div>

                  <hr className="border-gray-100" />

                  {/* Font selector — Pro+ */}
                  <div className={cn("space-y-3", !isPro && "opacity-70")}>
                    <div className="flex items-center gap-2">
                      <Type className="w-4 h-4 text-violet-500" />
                      <p className="text-sm font-semibold text-gray-800">Font style</p>
                      {!isPro && <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">Pro+</span>}
                    </div>
                    <p className="text-xs text-gray-400">Controls the typeface on your public booking page.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {FONTS.map((f) => (
                        <button key={f.id} type="button"
                          disabled={!isPro}
                          onClick={() => bf("fontFamily", f.id)}
                          className={cn("rounded-xl border-2 p-3 text-center transition-all",
                            fontVal === f.id ? "border-violet-500 bg-violet-50" : "border-gray-100 hover:border-gray-300 bg-white",
                            !isPro && "cursor-not-allowed")}>
                          <span className={cn("block text-2xl font-bold leading-tight text-gray-800 mb-1", f.style)}>{f.preview}</span>
                          <span className="text-[10px] font-medium text-gray-500">{f.label}</span>
                        </button>
                      ))}
                    </div>
                    {!isPro && <button type="button" onClick={() => promptUpgrade("PRO", "Custom fonts")} className="text-xs font-semibold text-violet-600 hover:underline">Upgrade to Pro to unlock fonts</button>}
                  </div>

                  <hr className="border-gray-100" />

                  {/* Powered by toggle — Unlimited only */}
                  <div className={cn("flex flex-col gap-3 p-4 rounded-xl border sm:flex-row sm:items-center sm:justify-between", isUnlimited ? "border-gray-100 bg-gray-50" : "border-gray-100 bg-gray-50 opacity-75")}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800">Remove &quot;Powered by Pulse&quot; watermark</p>
                        {!isUnlimited && <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">Unlimited</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">Hides the Pulse credit line at the bottom of your booking page so clients only see your brand.</p>
                    </div>
                    <button type="button"
                      onClick={() => isUnlimited ? bf("hidePouredBy", !bookingSettings.hidePouredBy) : promptUpgrade("UNLIMITED", "Remove Pulse branding")}
                      role="switch"
                      aria-checked={!!(bookingSettings.hidePouredBy && isUnlimited)}
                      aria-label="Toggle remove Powered by Pulse"
                      className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0 ml-4",
                        bookingSettings.hidePouredBy && isUnlimited ? "bg-violet-600" : "bg-gray-200")}>
                      <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                        bookingSettings.hidePouredBy && isUnlimited ? "translate-x-6" : "translate-x-1")} />
                    </button>
                  </div>

                  {/* Live preview */}
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Booking page preview</p>
                    <div className="rounded-xl overflow-hidden border border-gray-100">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100" style={{ backgroundColor: brandHex + "18" }}>
                        {biz?.logoUrl
                          ? <Image src={biz.logoUrl} alt="" width={24} height={24} className="w-6 h-6 rounded-lg object-cover shrink-0" />
                          : <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: brandHex }}>
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            </div>
                        }
                        <span className="text-sm font-bold text-gray-900">{biz?.name ?? "Your business"}</span>
                      </div>
                      <div className="p-4 bg-gray-50">
                        {!!bookingSettings.tagline && <p className="text-xs text-gray-500 italic mb-3">{String(bookingSettings.tagline)}</p>}
                        <p className="text-base font-bold text-gray-900 mb-3">{String(bookingSettings.headline || `Book with ${biz?.name ?? "us"}`)}</p>
                        <button type="button" className="px-4 py-2 rounded-lg text-sm font-semibold shadow-sm"
                          style={{ backgroundColor: brandHex, color: bestText }}>Continue</button>
                      </div>
                    </div>
                    {!bookingSettings.hidePouredBy && (
                      <p className="text-center text-[10px] text-gray-400 mt-2">Powered by <span className="text-violet-500 font-medium">Pulse</span></p>
                    )}
                  </div>
                </div>
              );
            })()}

            {section === "locations" && (
              <div className="p-4 space-y-5 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Locations</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Manage multiple branches under one account. Staff and appointments are assigned per location.</p>
                </div>
                <FeatureError message={featureErrors.locations} onRetry={loadLocations} />
                <hr className="border-gray-100" />

                {!isUnlimited ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">Location limit reached</p>
                    <p className="text-xs text-amber-700 mt-1">Free and Basic allow 1 location. Pro allows 2. Upgrade to <strong>Unlimited</strong> to manage up to 5 branches, each with their own staff and calendar, under one account.</p>
                    <button type="button" onClick={() => { goSection("billing"); }} className="mt-2 text-xs font-semibold text-amber-800 underline">View plans →</button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {locations.length === 0 && <p className="text-xs text-gray-400">No extra locations yet.</p>}
                      {locations.map((loc) => (
                        <div key={loc.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{loc.name}</p>
                            {loc.address && <p className="text-xs text-gray-400 truncate">{loc.address}</p>}
                            {!loc.active && <span className="text-xs text-amber-600 font-medium">Inactive</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button"
                              onClick={async () => { try { await api.locations.update(bizId, loc.id, { active: !loc.active }); loadLocations(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } }}
                              className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50">
                              {loc.active ? "Deactivate" : "Activate"}
                            </button>
                            <button type="button"
                              onClick={() => setLocationToRemove(loc)}
                              className="text-xs text-red-600 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50">
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                      <p className="text-sm font-medium text-gray-700">Add location</p>
                      <Input placeholder="Location name (e.g. Downtown)" aria-label="Location name" value={locationForm.name} onChange={(e) => setLocationForm((p) => ({ ...p, name: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
                      <Input placeholder="Address (optional)" aria-label="Location address" value={locationForm.address} onChange={(e) => setLocationForm((p) => ({ ...p, address: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input placeholder="+1 (416) 555-0123" type="tel" aria-label="Location phone number" value={locationForm.phone} onChange={(e) => setLocationForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
                        <label htmlFor="loc-timezone" className="sr-only">Location timezone</label>
                        <select id="loc-timezone" value={locationForm.timezone} onChange={(e) => setLocationForm((p) => ({ ...p, timezone: e.target.value }))}
                          className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                          <option value="">Same timezone as business</option>
                          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
                        </select>
                      </div>
                      <Button type="button" size="sm" loading={locationBusy}
                        onClick={async () => {
                          if (!locationForm.name.trim()) { toast.error("Location name is required"); return; }
                          setLocationBusy(true);
                          try {
                            await api.locations.create(bizId, { name: locationForm.name, address: locationForm.address || undefined, phone: locationForm.phone || undefined, timezone: locationForm.timezone || undefined });
                            setLocationForm({ name: "", address: "", phone: "", timezone: "" });
                            loadLocations();
                            toast.success("Location added");
                          } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to add location"); }
                          finally { setLocationBusy(false); }
                        }}
                      >Add location</Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {section === "payouts" && (
              <div className="p-4 space-y-5 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Payouts</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Connect your bank account and withdraw your earnings. Powered by Stripe Connect.</p>
                </div>
                <FeatureError message={featureErrors.connect} onRetry={loadConnect} />
                <hr className="border-gray-100" />

                {/* Pricing table */}
                <div className="rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Transaction fee schedule</p>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Plan</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Monthly</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Card-present</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Card-not-present</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">Online</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: "FREE",      name: "Free",      mo: "$0",   cp: "2.6% + $0.15", cnp: "3.5% + $0.15", online: "3.3% + $0.30" },
                        { id: "BASIC",     name: "Basic",     mo: "$19",  cp: "2.5% + $0.15", cnp: "3.5% + $0.15", online: "2.9% + $0.30" },
                        { id: "PRO",       name: "Pro",       mo: "$39",  cp: "2.4% + $0.15", cnp: "3.5% + $0.15", online: "2.9% + $0.00" },
                        { id: "UNLIMITED", name: "Unlimited", mo: "$79",  cp: "2.4% + $0.15", cnp: "3.5% + $0.15", online: "2.9% + $0.00" },
                      ].map((row) => (
                        <tr key={row.id} className={cn("border-b border-gray-50 last:border-0", plan === row.id && "bg-violet-50")}>
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{row.name}{plan === row.id && <span className="ml-1.5 text-violet-600">(current)</span>}</td>
                          <td className="px-4 py-2.5 text-gray-600">{row.mo}/mo</td>
                          <td className="px-4 py-2.5 text-gray-600">{row.cp}</td>
                          <td className="px-4 py-2.5 text-gray-600">{row.cnp}</td>
                          <td className="px-4 py-2.5 text-gray-600">{row.online}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>

                {/* Connect status + onboarding */}
                {!connectStatus && !featureErrors.connect ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : !connectStatus ? (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-800">Payout status unavailable</p>
                    <p className="mt-1 text-xs text-gray-500">Retry above, or open Billing if you need to confirm your plan while Stripe status is unavailable.</p>
                  </div>
                ) : !connectStatus.onboarded ? (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-violet-900">Connect your bank account</p>
                    <p className="text-xs text-violet-700">Complete a quick Stripe onboarding to link your bank account. Once connected, you can transfer your earnings anytime — instantly or on a schedule.</p>
                    <ul className="text-xs text-violet-700 space-y-1 ml-3 list-disc">
                      <li><strong>Holding Funds:</strong> Client payments are securely routed to your Stripe balance.</li>
                      <li><strong>Flexible Payouts:</strong> Withdraw to your bank whenever you choose via the Stripe Express dashboard.</li>
                      <li><strong>Instant Payouts:</strong> Transfer to a debit card for immediate access (instant payout fee applies).</li>
                    </ul>
                    <button type="button" disabled={connectBusy !== null}
                      onClick={async () => {
                        setConnectBusy("onboard");
                        try { const { url } = await api.connect.onboard(); window.location.assign(url); }
                        catch (e) { toast.error(e instanceof Error ? e.message : "Could not start Stripe onboarding"); setConnectBusy(null); }
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                      {connectBusy === "onboard" ? "Redirecting…" : "Set up payouts with Stripe"}
                    </button>
                  </div>
                ) : !connectStatus.chargesEnabled ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">Verification in progress</p>
                        <p className="text-xs text-amber-700 mt-1">You&apos;ve submitted your information — Stripe is reviewing your account. This typically takes a few minutes to 1 business day. You&apos;ll receive an email when it&apos;s approved.</p>
                        <p className="text-xs text-amber-600 mt-2">Payments made before approval are held safely in your Stripe balance and will be available once verified.</p>
                      </div>
                    </div>
                    <button type="button" disabled={connectBusy !== null}
                      onClick={async () => {
                        setConnectBusy("dashboard");
                        try { const { url } = await api.connect.dashboard(); window.open(url, "_blank", "noopener,noreferrer"); }
                        catch (e) { toast.error(e instanceof Error ? e.message : "Could not open dashboard"); }
                        finally { setConnectBusy(null); }
                      }}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 border border-amber-300 rounded-lg px-3 py-2 hover:bg-amber-100 disabled:opacity-60 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {connectBusy === "dashboard" ? "Opening…" : "Check status in Stripe dashboard"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">Bank account connected</p>
                        <p className="text-xs text-emerald-700 mt-0.5">Your Stripe Express account is active and ready to receive payouts.</p>
                      </div>
                    </div>

                    {/* Balance */}
                    {connectStatus.available.length > 0 && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-gray-100 bg-white p-4">
                          <p className="text-xs text-gray-400 mb-1">Available balance</p>
                          {connectStatus.available.map((b) => (
                            <p key={b.currency} className="text-xl font-bold text-gray-900">${(b.amount / 100).toFixed(2)} <span className="text-sm font-normal text-gray-400">{b.currency.toUpperCase()}</span></p>
                          ))}
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-white p-4">
                          <p className="text-xs text-gray-400 mb-1">Pending</p>
                          {connectStatus.pending.map((b) => (
                            <p key={b.currency} className="text-xl font-bold text-gray-500">${(b.amount / 100).toFixed(2)} <span className="text-sm font-normal text-gray-400">{b.currency.toUpperCase()}</span></p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Manual payout */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                      <p className="text-sm font-medium text-gray-700">Withdraw funds</p>
                      <div className="flex gap-2">
                        <Input
                          type="number" min="1" step="0.01" placeholder="Amount (e.g. 100.00)"
                          aria-label="Payout amount"
                          value={payoutAmount} onChange={(e) => {
                            setPayoutAmount(e.target.value);
                            payoutIdempotencyKey.current = null;
                          }}
                          className="flex-1"
                        />
                        <Button type="button" loading={connectBusy === "payout"}
                          onClick={async () => {
                            const cents = Math.round(parseFloat(payoutAmount) * 100);
                            if (!cents || cents < 100) { toast.error("Minimum payout is $1.00"); return; }
                            payoutIdempotencyKey.current ??= crypto.randomUUID();
                            setConnectBusy("payout");
                            try {
                              await api.connect.payout(cents, false, biz?.currency?.toLowerCase(), payoutIdempotencyKey.current);
                              toast.success("Payout initiated — funds will arrive in 1–2 business days");
                              payoutIdempotencyKey.current = null;
                              setPayoutAmount(""); loadConnect();
                            } catch (e) { toast.error(e instanceof Error ? e.message : "Payout failed"); }
                            finally { setConnectBusy(null); }
                          }}
                        >Withdraw</Button>
                      </div>
                      <p className="text-xs text-gray-400">Standard payout: 1–2 business days. Instant payout available via the Stripe Express dashboard.</p>
                    </div>

                    <button type="button" disabled={connectBusy !== null}
                      onClick={async () => {
                        setConnectBusy("dashboard");
                        try { const { url } = await api.connect.dashboard(); window.open(url, "_blank", "noopener,noreferrer"); }
                        catch (e) { toast.error(e instanceof Error ? e.message : "Could not open dashboard"); }
                        finally { setConnectBusy(null); }
                      }}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-violet-600 border border-violet-300 rounded-lg px-3 py-2 hover:bg-violet-50 disabled:opacity-60 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {connectBusy === "dashboard" ? "Opening…" : "Open Stripe Express dashboard"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {section === "notifications" && (
              <div className="p-4 space-y-4 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Choose what emails and SMS messages are sent to clients.</p>
                </div>
                <hr className="border-gray-100" />

                {/* Plan capability summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  {([
                    { id: "FREE",      label: "Free",      lines: ["In-app messaging only", "Confirmation email", "Cancellation & reschedule"] },
                    { id: "BASIC",     label: "Basic",     lines: ["Receive SMS from clients", "Reply when texted first", "24h email reminder", "+ all Free"] },
                    { id: "PRO",       label: "Pro",       lines: ["Initiate SMS first", "SMS confirmation", "2h SMS reminder", "72h email reminder", "+ all Basic"] },
                    { id: "UNLIMITED", label: "Unlimited", lines: ["All Pro features", "Across all locations", "Multi-location inbox"] },
                  ] as const).map((p) => (
                    <div key={p.id} className={cn("rounded-xl border p-3", plan === p.id ? "border-violet-300 bg-violet-50" : "border-gray-100 bg-gray-50")}>
                      <p className={cn("font-semibold mb-1.5", plan === p.id ? "text-violet-700" : "text-gray-500")}>{p.label}{plan === p.id && " ✓"}</p>
                      <p className="text-gray-500 leading-relaxed whitespace-pre-line text-left">{p.lines.join("\n")}</p>
                    </div>
                  ))}
                </div>

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email notifications</p>
                {([
                  { key: "emailConfirmation" as const,     label: "Booking confirmation",    desc: "Sent immediately when a new appointment is booked", tier: "FREE" as const },
                  { key: "emailReminder72h" as const,      label: "72-hour reminder",         desc: "Sent 3 days before the appointment (Pro only)",     tier: "PRO"  as const },
                  { key: "emailReminder24h" as const,      label: "24-hour reminder",         desc: "Sent the day before the appointment",               tier: "BASIC" as const },
                  { key: "emailFollowUp" as const,         label: "Post-visit follow-up",     desc: "Thank-you email sent 24h after the appointment to encourage rebooking", tier: "BASIC" as const },
                  { key: "emailCancellation" as const,     label: "Cancellation notice",      desc: "Sent when a booking is cancelled by client or business", tier: "FREE" as const },
                  { key: "emailReschedule" as const,       label: "Reschedule notice",        desc: "Sent when an appointment is moved to a new time",   tier: "FREE" as const },
                  { key: "emailStaffCancellation" as const,label: "Staff cancellation email", desc: "Special email when the business cancels on the client", tier: "FREE" as const },
                ] as const).map(({ key, label, desc, tier }) => {
                  const allowed = tier === "FREE" || (tier === "BASIC" && isPaid) || (tier === "PRO" && isPro);
                  const enabled = notificationSettings[key] !== false;
                  const badgeLabel = tier === "PRO" ? "Pro" : tier === "BASIC" ? "Basic+" : null;
                  return (
                    <div key={key} className="flex flex-col gap-3 py-3 border-b border-gray-50 last:border-0 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-700">{label}</p>
                          {badgeLabel && (
                            <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-md", tier === "PRO" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700")}>
                              {badgeLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      {allowed ? (
                        <div className="inline-flex shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-1">
                          {([{ label: "On", value: true }, { label: "Off", value: false }] as const).map((opt) => (
                            <button key={opt.label} type="button" onClick={() => nf(key, opt.value)}
                              aria-pressed={enabled === opt.value}
                              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                                enabled === opt.value ? "bg-violet-600 text-white" : "text-gray-500 hover:bg-gray-50")}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button type="button" onClick={() => promptUpgrade(tier === "PRO" ? "PRO" : "BASIC", label)}
                          className="self-start text-xs font-semibold text-violet-600 border border-violet-300 rounded-lg px-3 py-1.5 hover:bg-violet-50 transition-colors shrink-0">
                          {tier === "PRO" ? "Upgrade to Pro" : "Basic+"}
                        </button>
                      )}
                    </div>
                  );
                })}

                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                  <p className="font-semibold text-blue-800 mb-0.5">Messaging tiers</p>
                  <p><span className="font-semibold">Free:</span> In-app chat only — no SMS.</p>
                  <p><span className="font-semibold">Basic:</span> Receive client SMS + reply when they text first.</p>
                  <p><span className="font-semibold">Pro:</span> Initiate SMS to any client with a booking + automated reminders.</p>
                  <p><span className="font-semibold">Unlimited:</span> All Pro features across every location.</p>
                </div>

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">SMS notifications (Pro+)</p>
                {([
                  { key: "smsConfirmation" as const, label: "Booking confirmation SMS", desc: "Text sent immediately when a booking is confirmed" },
                  { key: "smsReminder2h"   as const, label: "2-hour SMS reminder",      desc: "Sent 2 hours before the appointment via Twilio" },
                ] as const).map(({ key, label, desc }) => {
                  const enabled = notificationSettings[key] !== false;
                  return (
                    <div key={key} className="flex flex-col gap-3 py-3 border-b border-gray-50 last:border-0 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      {isPro ? (
                        <div className="inline-flex shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-1">
                          {([{ label: "On", value: true }, { label: "Off", value: false }] as const).map((opt) => (
                            <button key={opt.label} type="button" onClick={() => nf(key, opt.value)}
                              aria-pressed={enabled === opt.value}
                              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                                enabled === opt.value ? "bg-violet-600 text-white" : "text-gray-500 hover:bg-gray-50")}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button type="button" onClick={() => goSection("billing")}
                          className="text-xs font-semibold text-violet-600 border border-violet-300 rounded-lg px-3 py-1 hover:bg-violet-50 transition-colors shrink-0">
                          Upgrade to Pro
                        </button>
                      )}
                    </div>
                  );
                })}

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-800 mb-1">Email provider: Resend · SMS provider: Twilio</p>
                  <p className="text-xs text-blue-600">Confirmations, cancellations, and reschedules are always sent on every plan. Reminders, follow-ups, and SMS messages follow the plan gating shown above. All appointment emails include a calendar (.ics) attachment as a backup.</p>
                </div>
              </div>
            )}

            {section === "security" && (
              <div className="p-4 space-y-4 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Security</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Protect your account with a second step at sign-in.</p>
                </div>
                <hr className="border-gray-100" />

                <div>
                  <label htmlFor="set-2fa-password" className="block text-xs font-medium text-gray-700 mb-1.5">Current password</label>
                  <Input
                    id="set-2fa-password"
                    type="password"
                    autoComplete="current-password"
                    value={twoFAPassword}
                    onChange={(e) => setTwoFAPassword(e.target.value)}
                    placeholder="Required to change two-factor settings"
                  />
                </div>

                <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Two-factor sign-in</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      After your password, we&apos;ll ask for a one-time code. You can remember a browser for 30 days; clearing its cookies or changing browser profiles requires another code.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={twoFA}
                    disabled={twoFASaving}
                    onClick={() => saveTwoFactor(!twoFA, twoFAMethod)}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50",
                      twoFA ? "bg-violet-600" : "bg-gray-300",
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                      twoFA && "translate-x-5",
                    )} />
                  </button>
                </div>

                {twoFA && (
                  <div className="pt-1">
                    <p className="text-xs font-medium text-gray-700 mb-2">Send the code by</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["EMAIL", "SMS"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          disabled={twoFASaving}
                          onClick={() => saveTwoFactor(true, m)}
                          className={cn(
                            "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-50",
                            twoFAMethod === m
                              ? "border-violet-300 bg-violet-50 text-violet-700"
                              : "border-gray-200 text-gray-600 hover:border-gray-300",
                          )}
                        >
                          {m === "EMAIL" ? "Email" : "Text message"}
                        </button>
                      ))}
                    </div>
                    {twoFAMethod === "SMS" && (
                      <p className="text-xs text-amber-600 mt-2">
                        Make sure your account has a mobile number on file — codes fall back to email otherwise.
                      </p>
                    )}
                  </div>
                )}

                {recoveryCodes && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">Save your recovery codes</p>
                    <p className="text-xs text-amber-700 mt-0.5 mb-3">
                      Each code works once. If you ever can&apos;t receive your verification code, enter one of these to sign in. They won&apos;t be shown again.
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 font-mono text-sm text-gray-800 bg-white rounded-lg border border-amber-100 p-3 min-[400px]:grid-cols-2">
                      {recoveryCodes.map((c) => <span key={c}>{c}</span>)}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button type="button"
                        onClick={() => { navigator.clipboard?.writeText(recoveryCodes.join("\n")).then(() => toast.success("Recovery codes copied")).catch(() => toast.error("Could not copy codes")); }}
                        className="text-xs font-semibold text-amber-800 border border-amber-300 rounded-lg px-3 py-1.5 hover:bg-amber-100">
                        Copy codes
                      </button>
                      <button type="button" onClick={() => setRecoveryCodes(null)}
                        className="text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                        I&apos;ve saved them
                      </button>
                    </div>
                  </div>
                )}

                <hr className="border-gray-100" />
                <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Password</p>
                    <p className="text-xs text-gray-400 mt-0.5">Change the password you use to sign in.</p>
                  </div>
                  <a href="/change-password"
                    className="text-xs font-semibold text-violet-600 border border-violet-300 rounded-lg px-3 py-1.5 hover:bg-violet-50 transition-colors shrink-0">
                    Change
                  </a>
                </div>
              </div>
            )}

            {section === "billing" && (
              <div className="p-4 space-y-5 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Billing &amp; plan</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Choose the plan that fits your business.</p>
                </div>
                <FeatureError message={featureErrors.subscription || featureErrors.referrals} onRetry={() => {
                  loadSubscription().catch(() => {});
                  api.referrals.get()
                    .then((r) => { setMyReferral({ code: r.code, referredCount: r.referredCount }); clearFeatureError("referrals"); })
                    .catch((e) => recordFeatureError("referrals", e, "Could not load referral details"));
                }} />
                <hr className="border-gray-100" />

                <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Current plan: {(subscription?.plan ?? biz?.plan ?? "FREE").toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                      </p>
                      {billingBusy === "confirming" ? (
                        <p className="mt-1 text-xs font-medium text-violet-700">Confirming your Stripe subscription...</p>
                      ) : subscription?.status === "PAST_DUE" ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">Payment is past due. Update your payment method to avoid losing paid features.</p>
                      ) : subscription?.cancelAtPeriodEnd ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Cancellation scheduled. Paid access continues until {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "the end of this billing period"}.
                        </p>
                      ) : (subscription?.plan ?? biz?.plan ?? "FREE") !== "FREE" ? (
                        <p className="mt-1 text-xs text-gray-600">
                          Renews automatically{subscription?.currentPeriodEnd ? ` on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}` : " each billing period"} until canceled.
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-600">No recurring subscription charge.</p>
                      )}
                    </div>
                    {subscription?.status && (
                      <span className="w-fit rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                        {subscription.status.replaceAll("_", " ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Referral: apply a code for a discount + share your own */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Have a referral code?</p>
                    <p className="text-xs text-amber-700 mt-0.5">Enter it before upgrading. If the code is valid and the referral coupon is configured, Stripe applies the discount at checkout.</p>
                    <input
                      aria-label="Referral code"
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                      placeholder="PULSE-XXXXXX"
                      className="mt-2 w-full sm:w-64 text-sm border border-amber-300 rounded-lg px-3 py-2 bg-white uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  {myReferral && (
                    <div className="border-t border-amber-200 pt-3">
                      <p className="text-sm font-semibold text-amber-900">Share Pulse</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Send your link to another Canadian business. When they subscribe with your code, Pulse records the referral and credits your account after their subscription starts{myReferral.referredCount > 0 ? ` (${myReferral.referredCount} referred so far)` : ""}.
                      </p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <code className="text-xs font-bold text-amber-900 bg-white border border-amber-300 rounded-lg px-3 py-2 break-all">
                          https://www.pulseappointments.com/register?ref={myReferral.code}
                        </code>
                        <button type="button"
                          onClick={() => { navigator.clipboard.writeText(`https://www.pulseappointments.com/register?ref=${myReferral.code}`).then(() => { setRefCopied(true); setTimeout(() => setRefCopied(false), 1500); }).catch(() => toast.error("Could not copy link")); }}
                          className="w-fit text-xs font-semibold text-amber-700 border border-amber-300 rounded-lg px-2.5 py-2 hover:bg-amber-100 transition-colors">
                          {refCopied ? "Copied!" : "Copy link"}
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-amber-700">Code: <span className="font-semibold tracking-wide">{myReferral.code}</span></p>
                    </div>
                  )}
                </div>

                <div className="mb-4 inline-flex rounded-xl border border-gray-200 bg-white p-1">
                  {[
                    { id: "month" as const, label: "Monthly" },
                    { id: "year" as const, label: "Annual", suffix: "2 months free" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setBillingInterval(option.id)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                        billingInterval === option.id
                          ? "bg-violet-600 text-white"
                          : "text-gray-500 hover:bg-gray-50",
                      )}
                    >
                      {option.label}
                      {option.suffix && <span className="ml-1 opacity-80">· {option.suffix}</span>}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4">
                  {[
                    {
                      id: "FREE", name: "Free", monthlyPrice: 0, annualPrice: 0,
                      desc: "Get started with the essentials",
                      features: ["Unlimited bookings","Client management","Public booking page","Email confirmations, cancellations & reschedules","Recurring appointment series","Dashboard & notification center","Up to 5 staff members","1 location"],
                      cta: "Current plan", disabled: true,
                    },
                    {
                      id: "BASIC", name: "Basic", monthlyPrice: 19, annualPrice: 190,
                      desc: "Great for growing businesses",
                      recommended: true,
                      features: ["Everything in Free","Receive SMS from clients + reply","Email reminders (24h)","Deposit collection","Manual charges","Cancellation policies","Up to 10 staff members"],
                      cta: "Upgrade to Basic", disabled: false,
                    },
                    {
                      id: "PRO", name: "Pro", monthlyPrice: 39, annualPrice: 390,
                      desc: "Full power for busy businesses",
                      highlight: true,
                      features: ["Everything in Basic","Initiate SMS to clients first","SMS confirmations & 2h reminders","Automatic no-show fees","Late-cancellation fees","72h email reminder","Priority support","Analytics & reports","Up to 10 staff members"],
                      cta: "Upgrade to Pro", disabled: false,
                    },
                    {
                      id: "UNLIMITED", name: "Unlimited", monthlyPrice: 79, annualPrice: 790,
                      desc: "Multi-location — for enterprise businesses",
                      features: ["Everything in Pro","Up to 5 locations","Full SMS across all locations","Remove Pulse branding","Unlimited staff accounts","Dedicated support","Early access to new features"],
                      cta: "Upgrade to Unlimited", disabled: false,
                    },
                  ].map((plan) => (
                    <div key={plan.id} className={cn(
                      "rounded-2xl border-2 p-5 relative",
                      plan.recommended ? "border-emerald-500 bg-emerald-50/50"
                        : plan.highlight ? "border-violet-500 bg-violet-50"
                        : "border-gray-100 bg-white",
                    )}>
                      {plan.recommended && (
                        <span className="absolute -top-2.5 left-5 text-xs font-bold text-white bg-emerald-600 px-3 py-0.5 rounded-full">
                          ★ Recommended
                        </span>
                      )}
                      {plan.highlight && !plan.recommended && (
                        <span className="absolute -top-2.5 left-5 text-xs font-bold text-white bg-violet-600 px-3 py-0.5 rounded-full">
                          Most popular
                        </span>
                      )}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-gray-900">
                              {plan.monthlyPrice === 0 ? "$0" : billingInterval === "year" ? `$${plan.annualPrice}` : `$${plan.monthlyPrice}`}
                            </span>
                            <span className="text-sm text-gray-400">{plan.monthlyPrice === 0 ? "/mo" : billingInterval === "year" ? "/yr" : "/mo"}</span>
                          </div>
                          <p className="font-semibold text-gray-800 mt-0.5">{plan.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {plan.desc}
                            {billingInterval === "year" && plan.monthlyPrice > 0 ? " Annual billing gives you 2 months free." : ""}
                          </p>
                        </div>
                        {(() => {
                          const RANK: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2, UNLIMITED: 3 };
                          const currentPlan = biz?.plan ?? "FREE";
                          const isCurrent = currentPlan === plan.id;
                          const isDowngrade = (RANK[plan.id] ?? 0) < (RANK[currentPlan] ?? 0);
                          const canBuy = (plan.id === "BASIC" || plan.id === "PRO" || plan.id === "UNLIMITED") && !isCurrent && !isDowngrade;
                          const label = isCurrent ? "Current plan"
                            : billingBusy === plan.id ? "Redirecting…"
                            : isDowngrade ? `Manage ${plan.name} downgrade`
                            : plan.cta;
                          return (
                            <button
                              type="button"
                              disabled={isCurrent || billingBusy !== null}
                              onClick={() => {
                                if (canBuy) upgrade(plan.id as "BASIC" | "PRO" | "UNLIMITED");
                                else if (isDowngrade && subscription?.hasBilling) manageBilling();
                                else if (!isCurrent) toast.info("To downgrade, manage your subscription from the billing portal below.");
                              }}
                              className={cn(
                                "text-xs font-semibold px-4 py-2 rounded-xl transition-colors shrink-0",
                                isCurrent
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : plan.recommended
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                  : plan.highlight
                                  ? "bg-violet-600 text-white hover:bg-violet-700"
                                  : "border border-violet-300 text-violet-600 hover:bg-violet-50",
                                billingBusy !== null && "opacity-60",
                              )}>
                              {label}
                            </button>
                          );
                        })()}
                      </div>
                      <ul className="mt-4 space-y-1.5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                            <CheckCircle2 className={cn("w-3.5 h-3.5 shrink-0", plan.highlight && !plan.recommended ? "text-violet-500" : "text-emerald-500")} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {(biz?.plan ?? "FREE") !== "FREE" && (
                  <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Stripe billing portal</p>
                      <p className="text-xs text-gray-400 mt-0.5">Update your card, view invoices, or cancel automatic renewal. Cancellation normally takes effect at the end of the paid period.</p>
                    </div>
                    <button type="button" onClick={manageBilling} disabled={billingBusy !== null}
                      className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 disabled:opacity-60 transition-colors shrink-0">
                      {billingBusy === "portal" ? "Opening…" : "Manage billing"}
                    </button>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">SMS reminders require Pro</p>
                    <p className="text-xs text-amber-600 mt-0.5">Upgrade to Pro to send 2-hour SMS reminders to clients. Email reminders are available on Basic and above.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/95 px-4 py-3 backdrop-blur sm:px-6">
              {section !== "billing" && section !== "security" && section !== "payouts" && section !== "locations" && section !== "calendar" ? (
                <>
                  <p className={cn("text-xs", dirty ? "text-amber-700" : "text-gray-400")}>
                    {dirty ? "Changes on this page are not saved yet." : "No unsaved changes."}
                  </p>
                  <Button type="submit" loading={saving} disabled={!dirty} size="md">
                    Save changes
                  </Button>
                </>
              ) : (
                <p className="text-xs text-gray-400">
                  This section saves with its own buttons or connects to an external provider.
                </p>
              )}
            </div>
          </form>
        </div>

      </div>

    </div>

    <ConfirmDialog
      open={locationToRemove !== null}
      title="Remove location"
      description={`Remove "${locationToRemove?.name}"? Staff assigned to this location will become unassigned.`}
      confirmLabel="Remove"
      variant="destructive"
      onConfirm={async () => {
        if (!locationToRemove) return;
        try {
          await api.locations.remove(bizId, locationToRemove.id);
          loadLocations();
          toast.success("Location removed");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed");
        } finally {
          setLocationToRemove(null);
        }
      }}
      onCancel={() => setLocationToRemove(null)}
    />
    </>
  );
}

export default function SettingsPageWrapper() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SettingsPage />
    </Suspense>
  );
}
