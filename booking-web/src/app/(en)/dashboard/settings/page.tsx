"use client";

import { useEffect, useState, Suspense, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Copy, Check, Globe, Clock, DollarSign, Building2, ChevronRight, CreditCard, Zap, CheckCircle2, ShieldCheck, CalendarDays, AlertTriangle, MapPin, Banknote, ExternalLink, Download, QrCode, Palette, Type, Braces } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – react-qr-code ships types but they're not resolved via "exports"; works fine at runtime
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { api, Business, VerificationStatus, Location } from "@/lib/api";
import { notifyLocationsChanged } from "@/lib/location-scope";
import { useCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ImageUpload } from "@/components/ImageUpload";
import { cn, formatPhoneInput, formatPhoneDisplay } from "@/lib/utils";
import { useEvents } from "@/lib/hooks";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { trackEvent } from "@/lib/analytics";
import { useDashboardLocale } from "@/lib/dashboard-locale";

const TIMEZONES = [
  "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "America/Anchorage","Pacific/Honolulu","America/Toronto","America/Vancouver",
  "America/Edmonton","America/Winnipeg","America/Regina","America/Halifax",
  "America/St_Johns","America/Whitehorse",
  "Europe/London","Europe/Paris","Europe/Berlin","Asia/Dubai","Asia/Kolkata",
  "Asia/Singapore","Asia/Tokyo","Australia/Sydney","Pacific/Auckland",
];

// Canadian combined sales-tax rates by province/territory (GST/HST/PST/QST), 2026.
const CA_TAX: { code: string; label: string; rate: number }[] = [
  { code: "AB", label: "Alberta", rate: 5 },
  { code: "BC", label: "British Columbia", rate: 12 },
  { code: "MB", label: "Manitoba", rate: 12 },
  { code: "NB", label: "New Brunswick", rate: 15 },
  { code: "NL", label: "Newfoundland and Labrador", rate: 15 },
  { code: "NS", label: "Nova Scotia", rate: 14 },
  { code: "NT", label: "Northwest Territories", rate: 5 },
  { code: "NU", label: "Nunavut", rate: 5 },
  { code: "ON", label: "Ontario", rate: 13 },
  { code: "PE", label: "Prince Edward Island", rate: 15 },
  { code: "QC", label: "Quebec", rate: 14.975 },
  { code: "SK", label: "Saskatchewan", rate: 11 },
  { code: "YT", label: "Yukon", rate: 5 },
];

type Section = "profile" | "locations" | "booking" | "calendar" | "payments" | "payouts" | "online" | "branding" | "security" | "billing";
type SubscriptionDetails = {
  plan: string;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasBilling: boolean;
};

// Labels and group names come from the dictionary (settings.nav / settings.groups);
// `navKey` selects the nav entry, `group` is a dictionary group key.
type GroupKey = "business" | "bookingSetup" | "bookingPage" | "payments" | "account";
const SECTIONS: { id: Section; navKey: Section; icon: React.ElementType; group: GroupKey }[] = [
  { id: "profile",   navKey: "profile",   icon: Building2,    group: "business" },
  { id: "locations", navKey: "locations", icon: MapPin,       group: "business" },
  { id: "booking",   navKey: "booking",   icon: Clock,        group: "bookingSetup" },
  { id: "calendar",  navKey: "calendar",  icon: CalendarDays, group: "bookingSetup" },
  { id: "online",    navKey: "online",    icon: Globe,        group: "bookingPage" },
  { id: "branding",  navKey: "branding",  icon: Palette,      group: "bookingPage" },
  { id: "payments",  navKey: "payments",  icon: DollarSign,   group: "payments" },
  { id: "payouts",   navKey: "payouts",   icon: Banknote,     group: "payments" },
  { id: "billing",   navKey: "billing",   icon: CreditCard,   group: "payments" },
  { id: "security",  navKey: "security",  icon: ShieldCheck,  group: "account" },
];

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

type PolicyLabels = { day: string; days: string; hr: string; hrs: string; min: string };
function formatPolicyDuration(totalMinutes: number, l: PolicyLabels) {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalMinutes) ? totalMinutes : 0));
  const days = Math.floor(safe / 1440);
  const hours = Math.floor((safe % 1440) / 60);
  const minutes = safe % 60;
  if (days > 0) return `${days} ${days === 1 ? l.day : l.days}${hours ? ` ${hours} ${l.hr}` : ""}${minutes ? ` ${minutes} ${l.min}` : ""}`;
  if (hours > 0) return `${hours} ${hours === 1 ? l.hr : l.hrs}${minutes ? ` ${minutes} ${l.min}` : ""}`;
  return `${minutes} ${l.min}`;
}

function PolicyNumberInput({ value, min = 0, unit, unitLabel, label, onChange }: {
  value: number; min?: number; unit: "hours" | "days"; unitLabel: string; label: string; onChange: (minutes: number) => void;
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
      <span className="ml-2 text-sm font-medium text-gray-500">{unitLabel}</span>
    </div>
  );
}

function FeatureError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { dictionary } = useDashboardLocale();
  const t = dictionary.settings;
  if (!message) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <p className="font-semibold text-red-800">{t.featureErrorTitle}</p>
      <p className="mt-0.5 text-xs">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 text-xs font-semibold underline underline-offset-2">
          {t.retry}
        </button>
      )}
    </div>
  );
}

// Owner-defined intake/consultation questions shown to clients at booking.
// Saved independently of the main settings form.
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
  const { dictionary } = useDashboardLocale();
  const t = dictionary.settings;
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
      toast.error(t.toasts.twoFAPasswordRequired);
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
      toast.success(enabled ? t.toasts.twoFAEnabled : t.toasts.twoFADisabled);
    } catch (err) {
      setTwoFA(prev.enabled); setTwoFAMethod(prev.method); // roll back
      toast.error(err instanceof Error ? err.message : t.toasts.twoFAFailed);
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
      setLoadError(t.featureErrors.noBusiness);
      setLoading(false);
      return;
    }
    api.business.get(bizId)
      .then((b) => { setBiz(b); setForm({ ...b, phone: formatPhoneDisplay(b.phone) }); setDirty(false); })
      .catch((e) => { setLoadError(e instanceof Error ? e.message : t.featureErrors.loadSettings); setLoading(false); })
      .finally(() => setLoading(false));
  }, [bizId, isOwner, userLoading, t.featureErrors.noBusiness, t.featureErrors.loadSettings]);

  useEvents(
    bizId || null,
    useCallback(() => {}, []),
    useCallback((data: { plan: string; planExpiresAt: string | null }) => {
      setBiz((prev) => prev ? { ...prev, plan: data.plan as Business["plan"] } : prev);
      toast.success(t.toasts.planUpdated.replace("{plan}", data.plan.charAt(0) + data.plan.slice(1).toLowerCase()));
    }, [t.toasts.planUpdated]),
  );

  const f = (k: keyof Business, v: unknown) => {
    setDirty(true);
    setForm((p) => ({ ...p, [k]: v }));
  };
  const bookingSettings = (form.bookingPageSettings ?? {}) as Record<string, unknown>;
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
      recordFeatureError("subscription", e, t.featureErrors.subscription);
      throw e;
    }
  }, [clearFeatureError, recordFeatureError, t.featureErrors.subscription]);

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
      .catch((e) => recordFeatureError("locations", e, t.featureErrors.locations));
  }, [bizId, isOwner, clearFeatureError, recordFeatureError, t.featureErrors.locations]);
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
      .catch((e) => recordFeatureError("connect", e, t.featureErrors.connect));
  }, [isOwner, clearFeatureError, recordFeatureError, t.featureErrors.connect]);
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
      .catch((e) => recordFeatureError("referrals", e, t.featureErrors.referrals));
  }, [isOwner, searchParams, clearFeatureError, recordFeatureError, t.featureErrors.referrals]);

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
    }).catch((e) => recordFeatureError("verification", e, t.featureErrors.verification));
  }, [bizId, isOwner, clearFeatureError, recordFeatureError, t.featureErrors.verification]);
  async function submitVerification() {
    if (!bizId) return;
    if (!verificationForm.legalName.trim() || !verificationForm.address.trim() || !verificationForm.phone.trim() || !verificationForm.governmentIdUrl || !verificationForm.registrationDocUrl) {
      toast.error(t.toasts.verificationComplete);
      return;
    }
    setVerifBusy(true);
    try {
      const r = await api.verification.submit(bizId, verificationForm);
      setVerif({ status: r.verificationStatus, note: null });
      toast.success(t.toasts.verificationSubmitted);
    } catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.verificationFailed); }
    finally { setVerifBusy(false); }
  }

  // Google Calendar connection.
  const [cal, setCal] = useState<{ connected: boolean; email: string | null; configured: boolean } | null>(null);
  const loadCal = useCallback(() => {
    if (!isOwner) return;
    api.calendarSync.status()
      .then((status) => { setCal(status); clearFeatureError("calendar"); })
      .catch((e) => recordFeatureError("calendar", e, t.featureErrors.calendar));
  }, [isOwner, clearFeatureError, recordFeatureError, t.featureErrors.calendar]);
  useEffect(() => { loadCal(); }, [loadCal]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("calendar");
    if (p === "connected") { toast.success(t.toasts.calendarConnected); loadCal(); goSection("calendar"); }
    else if (p === "error") {
      const reason = params.get("reason") ?? "";
      const msg = reason.startsWith("google_denied") ? t.toasts.calendarDenied : reason === "missing_code" ? t.toasts.calendarInterrupted : t.toasts.calendarConnectFailed.replace("{reason}", reason ? `: ${reason}` : "");
      toast.error(msg);
      goSection("calendar");
    }
  }, [goSection, loadCal, t.toasts.calendarConnected, t.toasts.calendarDenied, t.toasts.calendarInterrupted, t.toasts.calendarConnectFailed]);
  async function connectCal() {
    try { const { url } = await api.calendarSync.connect(); window.location.assign(url); }
    catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.calendarStartFailed); }
  }
  async function disconnectCal() {
    try { await api.calendarSync.disconnect(); toast.success(t.toasts.calendarDisconnected); loadCal(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.calendarDisconnectFailed); }
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
      toast.info(t.toasts.checkoutCanceled);
      return;
    }
    if (result !== "success" || !sessionId || !bizId) {
      toast.error(t.toasts.checkoutInvalid);
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
          toast.success(t.toasts.subscriptionActive.replace("{plan}", String(confirmed.plan ?? business.plan)));
          return;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
      if (!cancelled) {
        toast.error(lastError instanceof Error ? lastError.message : t.toasts.subscriptionProcessing, { duration: 8000 });
      }
    };
    confirm().finally(() => { if (!cancelled) setBillingBusy(null); });
    return () => { cancelled = true; };
  }, [bizId, goSection, loadSubscription, t.toasts.subscriptionActive, t.toasts.checkoutCanceled, t.toasts.checkoutInvalid, t.toasts.subscriptionProcessing]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    // Also honour URL hash — e.g. #booking-policies → booking tab.
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    const hashToSection: Record<string, Section> = {
      "booking-policies": "booking",
      "booking": "booking",
      "payments": "payments",
      "payouts": "payouts",
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
      toast.success(t.toasts.connectConnected);
      goSection("payouts");
    } else if (connect === "refresh") {
      // Auto-restart onboarding
      api.connect.onboard().then(({ url }) => window.location.assign(url)).catch((e) => toast.error(e instanceof Error ? e.message : t.toasts.connectResumeFailed));
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
        toast.success(t.toasts.planSwitched.replace("{plan}", plan));
        trackEvent("subscription_plan_changed", { plan, billing_interval: billingInterval });
        if (bizId) Promise.all([api.business.get(bizId), loadSubscription()]).then(([b]) => { setBiz(b); setForm({ ...b, phone: formatPhoneDisplay(b.phone) }); }).catch(() => {});
        setBillingBusy(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.toasts.checkoutStartFailed);
      setBillingBusy(null);
    }
  }

  async function manageBilling() {
    setBillingBusy("portal");
    try {
      const { url } = await api.subscriptions.portal();
      window.location.assign(url);
    } catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.billingOpenFailed); setBillingBusy(null); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!bizId || !isOwner) return;
    if (form.requireDeposit && !isPaid) {
      promptUpgrade("BASIC", t.payments.depositsFeature);
      return;
    }
    if (form.requireDeposit) {
      const pct = Number(form.depositPercent);
      if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
        toast.error(t.toasts.depositRange);
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
        minNoticeMinutes: Number(form.minNoticeMinutes ?? 120),
        maxAdvanceMinutes,
        maxAdvanceDays: Math.max(1, Math.ceil(maxAdvanceMinutes / 1440)),
        cancellationWindowMinutes,
        cancellationWindowHours: Math.floor(cancellationWindowMinutes / 60),
        requireDeposit: !!form.requireDeposit,
        depositPercent: Math.max(1, Number(form.depositPercent ?? 25)),
        taxRatePercent: Math.max(0, Math.min(100, Number(form.taxRatePercent ?? 0))),
        taxProvince: (form.taxProvince as string) || null,
        noShowFeeCents: Math.max(0, Number(form.noShowFeeCents ?? 0)),
        cancellationFeeCents: Math.max(0, Number(form.cancellationFeeCents ?? 0)),
        collectCardOnFile: !!form.collectCardOnFile,
        currency: "CAD",
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
        toast.error(t.toasts.planStripped, { duration: 6000 });
      } else {
        toast.success(t.toasts.settingsSaved);
      }
    }
    catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.saveFailed); }
    finally { setSaving(false); }
  }

  function copyUrl() {
    navigator.clipboard.writeText(bookingUrl)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => toast.error(t.toasts.copyLinkFailed));
  }

  if (userLoading || loading) return <LoadingSpinner />;
  if (loadError) return (
    <div className="text-center py-20">
      <p className="text-red-500 mb-3">{loadError}</p>
      <button onClick={() => { setLoadError(""); setLoading(true); api.business.get(bizId).then((b) => { setBiz(b); setForm({ ...b, phone: formatPhoneDisplay(b.phone) }); setDirty(false); }).catch((e) => { setLoadError(e instanceof Error ? e.message : t.featureErrors.loadSettings); }).finally(() => setLoading(false)); }} className="text-violet-600 hover:underline text-sm">{t.retry}</button>
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
  const isUnlimited = plan === "UNLIMITED";
  const canManageLocations = biz?.capabilities?.multipleLocations ?? (plan === "PRO" || isUnlimited);
  function promptUpgrade(target: "BASIC" | "PRO" | "UNLIMITED", feature: string) {
    const label = target === "BASIC" ? t.upgradeLabels.basic : target === "PRO" ? t.upgradeLabels.pro : t.upgradeLabels.unlimited;
    toast.info(t.toasts.featureRequires.replace("{feature}", feature).replace("{label}", label));
    goSection("billing");
  }
  function copyEmbed() {
    navigator.clipboard.writeText(embedSnippet)
      .then(() => { setEmbedCopied(true); setTimeout(() => setEmbedCopied(false), 2000); })
      .catch(() => toast.error(t.toasts.copySnippetFailed));
  }

  return (
    <>
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{t.title}</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          {isOwner ? t.subtitleOwner : t.subtitleStaff}
        </p>
        {dirty && (
          <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            {t.unsavedChanges}
          </p>
        )}
      </div>

      {/* Duplicate account warning */}
      {biz?.suspectedDuplicateOfId && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">{t.duplicateTitle}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {t.duplicateBody}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-5">

        {/* Compact section picker — easier to scan than an 11-item horizontal tab strip. */}
        <div className="xl:hidden mb-4 relative -mx-3 sm:-mx-5">
          <div className="px-3 sm:px-5">
            <label htmlFor="settings-section" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t.sectionLabel}
            </label>
            <select
              id="settings-section"
              value={section}
              onChange={(e) => goSection(e.target.value as Section)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {[...new Set(visibleSections.map((s) => s.group))].map((group) => (
                <optgroup key={group} label={t.groups[group]}>
                  {visibleSections.filter((s) => s.group === group).map((s) => (
                    <option key={s.id} value={s.id}>{t.nav[s.navKey][0]}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Left nav */}
        <aside className="hidden xl:block w-56 shrink-0">
          <nav className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {visibleSections.map(({ id, navKey, icon: Icon, group }, i) => {
              const label = t.nav[navKey][0];
              const desc = t.nav[navKey][1];
              const isGroupStart = i === 0 || visibleSections[i - 1].group !== group;
              return (
                <div key={id} className={cn(!isGroupStart && i !== 0 && "border-t border-gray-50")}>
                  {isGroupStart && i !== 0 && (
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{t.groups[group]}</p>
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
                  <h3 className="text-sm font-semibold text-gray-900">{t.profile.title}</h3>
                  <p className="text-xs text-gray-600 mt-0.5">{t.profile.subtitle}</p>
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
                  }).catch((e) => recordFeatureError("verification", e, t.featureErrors.verification))}
                />
                <hr className="border-gray-100" />

                {/* Business verification */}
                {verif && verif.status === "VERIFIED" ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-sm font-medium text-emerald-800">{t.profile.verified}</p>
                  </div>
                ) : verif ? (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-5 h-5 text-violet-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-violet-900">{t.profile.verifyTitle}</p>
                        {verif.status === "PENDING" ? (
                          <p className="text-xs text-violet-700 mt-1">{t.profile.pending}</p>
                        ) : (
                          <>
                            <p className="text-xs text-violet-700 mt-1">
                              {t.profile.verifyBody}
                              {verif.status === "REJECTED" && verif.note ? t.profile.rejected.replace("{note}", verif.note) : ""}
                            </p>
                            <div className={cn("mt-3 space-y-3", verifBusy && "opacity-60 pointer-events-none")}>
                              <Input aria-label={t.profile.legalNameAria} placeholder={t.profile.legalNamePlaceholder} value={verificationForm.legalName} onChange={(e) => setVerificationForm((p) => ({ ...p, legalName:e.target.value }))} />
                              <Input aria-label={t.profile.addressAria} placeholder={t.profile.addressPlaceholder} value={verificationForm.address} onChange={(e) => setVerificationForm((p) => ({ ...p, address:e.target.value }))} />
                              <Input aria-label={t.profile.phoneAria} placeholder={t.profile.phonePlaceholder} type="tel" value={verificationForm.phone} onChange={(e) => setVerificationForm((p) => ({ ...p, phone:e.target.value }))} />
                              <div>
                                <p className="text-xs font-medium text-violet-700 mb-1.5">{t.profile.governmentId}</p>
                                <ImageUpload value={verificationForm.governmentIdUrl || null} documents onChange={(url) => setVerificationForm((p) => ({ ...p, governmentIdUrl:url ?? "" }))} />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-violet-700 mb-1.5">{t.profile.registration}</p>
                                <ImageUpload value={verificationForm.registrationDocUrl || null} documents onChange={(url) => setVerificationForm((p) => ({ ...p, registrationDocUrl:url ?? "" }))} />
                              </div>
                              <button
                                type="button"
                                onClick={() => submitVerification()}
                                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                                <ShieldCheck className="w-4 h-4" /> {t.profile.submitVerification}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                <Field label={t.profile.logo}>
                  <ImageUpload value={(form.logoUrl as string) ?? null} kind="LOGO" onChange={async (url) => {
                    setForm((p) => ({ ...p, logoUrl: url ?? "" }));
                    // Persist the logo on its own so it can't be lost to an unrelated
                    // invalid field elsewhere in the settings form.
                    if (!bizId) return;
                    try { await api.business.update(bizId, { logoUrl: url ?? "" }); toast.success(url ? t.toasts.logoSaved : t.toasts.logoRemoved); }
                    catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.logoFailed); }
                  }} />
                </Field>
                <Field label={t.profile.name} htmlFor="set-name">
                  <Input id="set-name" value={(form.name as string) ?? ""} onChange={(e) => f("name", e.target.value)} placeholder={t.profile.namePlaceholder} />
                </Field>
                <Field label={t.profile.email} htmlFor="set-email">
                  <Input id="set-email" type="email" value={(form.email as string) ?? ""} onChange={(e) => f("email", e.target.value)} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t.profile.phone} htmlFor="set-phone">
                    <Input id="set-phone" type="tel" placeholder={t.profile.contactPhonePlaceholder} value={(form.phone as string) ?? ""} onChange={(e) => f("phone", formatPhoneInput(e.target.value))} />
                  </Field>
                  <Field label={t.profile.timezone} htmlFor="biz-timezone">
                    <select id="biz-timezone" value={(form.timezone as string) ?? "America/New_York"} onChange={(e) => f("timezone", e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t.profile.address} htmlFor="set-address">
                    <Input id="set-address" value={(form.address as string) ?? ""} onChange={(e) => f("address", e.target.value)} placeholder={t.profile.addressFieldPlaceholder} />
                  </Field>
                  <Field label={t.profile.currency} htmlFor="biz-currency">
                    <select id="biz-currency" value="CAD" disabled
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                      <option value="CAD">{t.profile.currencyCad}</option>
                    </select>
                  </Field>
                </div>
                <div className="rounded-xl border border-gray-100 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t.profile.socialTitle}</p>
                    <p className="text-xs text-gray-400">{t.profile.socialSubtitle}</p>
                  </div>
                  <Field label={t.profile.thankYou} htmlFor="set-post-visit">
                    <Input id="set-post-visit" value={(form.postVisitMessage as string) ?? ""} onChange={(e) => f("postVisitMessage", e.target.value)} placeholder={t.profile.thankYouPlaceholder} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["websiteUrl", "instagramUrl", "facebookUrl", "tiktokUrl"] as const).map((key) => {
                      const LABELS: Record<string, string> = { websiteUrl: t.profile.website, instagramUrl: t.profile.instagram, facebookUrl: t.profile.facebook, tiktokUrl: t.profile.tiktok };
                      return (
                        <Field key={key} htmlFor={`set-${key}`} label={LABELS[key]}>
                          <Input id={`set-${key}`} type="url" value={(form[key] as string) ?? ""} onChange={(e) => f(key, e.target.value)} placeholder={t.profile.urlPlaceholder} />
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
                  <h3 className="text-sm font-semibold text-gray-900">{t.booking.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t.booking.subtitle}</p>
                </div>
                <Link
                  href="/dashboard/hours"
                  className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors"
                >
                  <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-900">{t.booking.hoursTitle}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{t.booking.hoursBody}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />
                </Link>
                <hr className="border-gray-100" />

                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                  {[
                    {
                      label: t.booking.minNoticeLabel,
                      desc: t.booking.minNoticeDesc,
                      value: (form.minNoticeMinutes as number) ?? 120,
                      min: 60,
                      unit: "hours" as const,
                      key: "minNoticeMinutes" as const,
                    },
                    {
                      label: t.booking.maxAdvanceLabel,
                      desc: t.booking.maxAdvanceDesc,
                      value: (form.maxAdvanceMinutes as number) ?? (((form.maxAdvanceDays as number) ?? 60) * 1440),
                      min: 7 * 1440,
                      unit: "days" as const,
                      key: "maxAdvanceMinutes" as const,
                    },
                    {
                      label: t.booking.cancelCutoffLabel,
                      desc: t.booking.cancelCutoffDesc,
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
                        <PolicyNumberInput value={item.value} min={item.min} unit={item.unit} unitLabel={t.units[item.unit]} label={item.label} onChange={(minutes) => f(item.key, minutes)} />
                        <p className="mt-1 text-xs text-gray-400">{t.policy.currently.replace("{duration}", formatPolicyDuration(item.value, t.policy))}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900">{t.booking.cancellationRuleTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-blue-700">
                    {t.booking.cancellationRuleBody}
                  </p>
                </div>

                <Field label={t.booking.policyLabel} htmlFor="set-cancel-policy">
                  <textarea
                    id="set-cancel-policy"
                    className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-violet-200"
                    value={(form.cancellationPolicy as string) ?? ""}
                    onChange={(e) => f("cancellationPolicy", e.target.value)}
                    placeholder={t.booking.policyPlaceholder} />
                  <p className="text-xs text-gray-400 mt-1">{t.booking.policyHint}</p>
                </Field>

                <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t.booking.selfRescheduleTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.booking.selfRescheduleDesc}</p>
                  </div>
                  <button type="button" onClick={() => f("allowClientReschedule", !form.allowClientReschedule)}
                    role="switch"
                    aria-checked={form.allowClientReschedule !== false}
                    aria-label={t.booking.selfRescheduleAria}
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.allowClientReschedule ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.allowClientReschedule ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t.booking.selfCancelTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.booking.selfCancelDesc}</p>
                  </div>
                  <button type="button" onClick={() => f("allowClientCancel", form.allowClientCancel === false ? true : false)}
                    role="switch"
                    aria-checked={form.allowClientCancel !== false}
                    aria-label={t.booking.selfCancelAria}
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.allowClientCancel !== false ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.allowClientCancel !== false ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t.booking.approvalTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.booking.approvalDesc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500">{form.bookingApprovalMode === "AUTO" ? t.booking.autoConfirm : t.booking.manualApproval}</span>
                    <button type="button"
                      onClick={() => f("bookingApprovalMode", form.bookingApprovalMode === "AUTO" ? "MANUAL" : "AUTO")}
                      role="switch"
                      aria-checked={form.bookingApprovalMode === "AUTO"}
                      aria-label={t.booking.approvalAria}
                      className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.bookingApprovalMode === "AUTO" ? "bg-violet-600" : "bg-gray-200")}>
                      <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.bookingApprovalMode === "AUTO" ? "translate-x-6" : "translate-x-1")} />
                    </button>
                  </div>
                </div>

                <Link href="/dashboard/forms" className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t.booking.intakeTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.booking.intakeDesc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </Link>

                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-violet-600" />
                    <p className="text-sm font-semibold text-gray-800">{t.booking.taxTitle}</p>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{t.booking.taxDesc}</p>
                  <div className="grid gap-3 sm:grid-cols-2 max-w-md">
                    <Field label={t.booking.province} htmlFor="biz-tax-province">
                      <select id="biz-tax-province" value={(form.taxProvince as string) ?? ""}
                        onChange={(e) => {
                          const code = e.target.value;
                          const preset = CA_TAX.find((p) => p.code === code);
                          setDirty(true);
                          setForm((p) => ({ ...p, taxProvince: code || null, ...(preset ? { taxRatePercent: preset.rate } : {}) }));
                        }}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                        <option value="">{t.booking.customRate}</option>
                        {CA_TAX.map((p) => <option key={p.code} value={p.code}>{p.label} — {p.rate}%</option>)}
                      </select>
                    </Field>
                    <Field label={t.booking.taxRate} htmlFor="set-tax-rate">
                      <div className="flex items-center gap-2">
                        <Input id="set-tax-rate" type="number" min={0} max={100} step={0.01}
                          aria-label={t.booking.taxRateAria}
                          value={(form.taxRatePercent as number) ?? 0}
                          onChange={(e) => f("taxRatePercent", Number(e.target.value))}
                          className="bg-white text-base font-semibold" />
                        <span className="text-sm font-medium text-gray-500">%</span>
                      </div>
                    </Field>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">{t.booking.taxFootnote}</p>
                </div>
              </div>
            )}

            {section === "calendar" && (
              <div className="p-4 space-y-5 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{t.calendar.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t.calendar.subtitle}</p>
                </div>
                <FeatureError message={featureErrors.calendar} onRetry={loadCal} />

                {/* ── iCal feed (primary, beginner-friendly) ───────────────── */}
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex w-9 h-9 rounded-lg bg-amber-100 items-center justify-center shrink-0">
                      <Download className="w-4 h-4 text-amber-700" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-amber-900">{t.calendar.icalTitle}</p>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        {t.calendar.icalBodyA}<strong>{t.calendar.icalBodyApps}</strong>{t.calendar.icalBodyB}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={api.calendarSync.icalFeedUrl()}
                      download="pulse-appointments.ics"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> {t.calendar.downloadIcs}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}${api.calendarSync.icalFeedUrl()}`;
                        navigator.clipboard.writeText(url).then(() => toast.success(t.toasts.feedCopied)).catch(() => toast.error(t.toasts.copyFailed));
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-amber-400 text-amber-800 text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      {t.calendar.copyLink}
                    </button>
                  </div>

                  {/* Step-by-step for beginners */}
                  <div className="rounded-lg bg-white/70 border border-amber-100 p-4 space-y-3 text-xs text-amber-900">
                    <p className="font-semibold text-amber-800">{t.calendar.howToTitle}</p>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold">{t.calendar.iphoneTitle}</p>
                        <p className="text-amber-700 mt-0.5">{t.calendar.iphoneStep}</p>
                      </div>
                      <div>
                        <p className="font-semibold">{t.calendar.googleTitle}</p>
                        <p className="text-amber-700 mt-0.5">{t.calendar.googleStepA}<strong>{t.calendar.googleStepPlus}</strong>{t.calendar.googleStepB}<strong>{t.calendar.googleStepFromUrl}</strong>{t.calendar.googleStepC}</p>
                      </div>
                      <div>
                        <p className="font-semibold">{t.calendar.outlookTitle}</p>
                        <p className="text-amber-700 mt-0.5">{t.calendar.outlookStep}</p>
                      </div>
                    </div>
                    <p className="text-amber-600 italic">{t.calendar.tip}</p>
                  </div>
                </div>

                {/* ── Google Calendar two-way sync (advanced) ──────────────── */}
                {cal?.configured && (
                  <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-violet-500" />
                      <p className="text-sm font-semibold text-gray-900">{t.calendar.twoWayTitle}</p>
                      <span className="ml-auto text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{t.calendar.advanced}</span>
                    </div>
                    {cal.connected ? (
                      <>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {t.calendar.connectedA}<strong>{cal.email}</strong>{t.calendar.connectedB}
                        </p>
                        <button type="button" onClick={disconnectCal}
                          className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors">{t.calendar.disconnect}</button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          {t.calendar.notConnectedA}<strong>{t.calendar.notConnectedBold}</strong>{t.calendar.notConnectedB}
                        </p>
                        <button type="button" onClick={connectCal}
                          className="text-xs font-semibold text-white bg-violet-600 rounded-lg px-3 py-2 hover:bg-violet-700 transition-colors">{t.calendar.connect}</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {section === "payments" && (
              <div className="p-4 space-y-4 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{t.payments.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t.payments.subtitle}</p>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-900">{t.payments.stripeTitle}</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md">{t.payments.stripeBody}</p>
                </div>

                <hr className="border-gray-100" />
                {isPaid && (
                  <p className="text-xs text-gray-400 -mt-1">{t.payments.enableHintA}<span className="font-semibold text-gray-600">{t.payments.enableHintBold}</span>{t.payments.enableHintB}</p>
                )}
                {!isPaid && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <p className="font-semibold">{t.payments.requireBasicTitle}</p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-700">{t.payments.requireBasicBody}</p>
                    <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => promptUpgrade("BASIC", t.payments.paymentsFeature)}>{t.payments.viewPlans}</button>
                  </div>
                )}
                {isPaid && !isPro && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                    <p className="font-semibold">{t.payments.basicActiveTitle}</p>
                    <p className="mt-1 text-xs leading-relaxed text-blue-700">{t.payments.basicActiveBody}</p>
                  </div>
                )}
                <div className={cn("flex flex-col gap-3 p-4 rounded-xl border sm:flex-row sm:items-center sm:justify-between", isPaid ? "border-gray-100 bg-gray-50" : "border-gray-100 bg-gray-50")}>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t.payments.requireDepositTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.payments.requireDepositDesc}</p>
                  </div>
                  <button type="button" onClick={() => isPaid ? f("requireDeposit", !form.requireDeposit) : promptUpgrade("BASIC", t.payments.depositsFeature)}
                    role="switch"
                    aria-checked={!!form.requireDeposit}
                    aria-label={t.payments.requireDepositAria}
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.requireDeposit ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.requireDeposit ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>
                {isPaid && form.requireDeposit && (
                  <Field label={t.payments.depositPercent} htmlFor="set-deposit-pct">
                    <div className="flex items-center gap-2">
                      <Input id="set-deposit-pct" type="number" min={1} max={100} value={(form.depositPercent as number) ?? 25}
                        onChange={(e) => f("depositPercent", Number(e.target.value))} />
                      <span className="text-sm text-gray-500 shrink-0">%</span>
                    </div>
                  </Field>
                )}

                <div className="flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="pr-3">
                    <p className="text-sm font-semibold text-gray-800">{t.payments.cardOnFileTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.payments.cardOnFileDesc}</p>
                  </div>
                  <button type="button" onClick={() => isPaid ? f("collectCardOnFile", !form.collectCardOnFile) : promptUpgrade("BASIC", t.payments.cardOnFileFeature)}
                    role="switch"
                    aria-checked={!!form.collectCardOnFile}
                    aria-label={t.payments.cardOnFileAria}
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.collectCardOnFile ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.collectCardOnFile ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={cn("rounded-xl border border-gray-100 bg-gray-50 p-4", !isPro && "opacity-85")}>
                    <Field label={t.payments.noShowFee} htmlFor="set-noshowfee">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 shrink-0">$</span>
                        <Input id="set-noshowfee" type="number" min={0} step="0.01" disabled={!isPro} onFocus={() => !isPro && promptUpgrade("PRO", t.payments.noShowFeature)}
                          value={(((form.noShowFeeCents as number) ?? 0) / 100).toString()}
                          onChange={(e) => f("noShowFeeCents", Math.round(Number(e.target.value) * 100))} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{t.payments.noShowFeeDesc}</p>
                      {!isPro && <button type="button" onClick={() => promptUpgrade("PRO", t.payments.noShowFeature)} className="mt-2 text-xs font-semibold text-violet-600 hover:underline">{t.payments.upgradeUnlock}</button>}
                    </Field>
                  </div>
                  <div className={cn("rounded-xl border border-gray-100 bg-gray-50 p-4", !isPro && "opacity-85")}>
                    <Field label={t.payments.lateFee} htmlFor="set-latefee">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 shrink-0">$</span>
                        <Input id="set-latefee" type="number" min={0} step="0.01" disabled={!isPro} onFocus={() => !isPro && promptUpgrade("PRO", t.payments.lateFeeFeature)}
                          value={(((form.cancellationFeeCents as number) ?? 0) / 100).toString()}
                          onChange={(e) => f("cancellationFeeCents", Math.round(Number(e.target.value) * 100))} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{t.payments.lateFeeDesc}</p>
                      {!isPro && <button type="button" onClick={() => promptUpgrade("PRO", t.payments.lateFeeFeature)} className="mt-2 text-xs font-semibold text-violet-600 hover:underline">{t.payments.upgradeUnlock}</button>}
                    </Field>
                  </div>
                </div>
                <div className="flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t.payments.manualTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.payments.manualDesc}</p>
                  </div>
                  <span className={cn("shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full", isPaid ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500")}>
                    {isPaid ? t.payments.available : t.payments.basicPlus}
                  </span>
                </div>
              </div>
            )}

            {section === "online" && (
              <div className="p-4 space-y-5 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{t.online.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t.online.subtitle}</p>
                </div>
                <hr className="border-gray-100" />
                <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-violet-600" />
                    <span className="text-sm font-semibold text-violet-700">{t.online.securePage}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-violet-200 rounded-xl px-4 py-3">
                    <code className="text-sm text-violet-600 flex-1 truncate">{bookingUrl}</code>
                    <button type="button" onClick={copyUrl} aria-label={t.online.copyUrlAria} className="text-gray-400 hover:text-violet-600 transition-colors shrink-0">
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-violet-500 mt-2">{t.online.shareHint}</p>

                  {/* Social share row */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(t.online.whatsappText.replace("{url}", bookingUrl))}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                    >
                      {t.online.whatsapp}
                    </a>
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(bookingUrl)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1877F2] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                    >
                      {t.online.facebook}
                    </a>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(t.online.emailSubject)}&body=${encodeURIComponent(t.online.emailBody.replace("{url}", bookingUrl))}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {t.online.email}
                    </a>
                  </div>

                  {/* Bio page link */}
                  {biz?.slug && (
                    <div className="mt-3 rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 text-xs text-violet-800">
                      <span className="font-semibold">{t.online.bioLabel}</span> {t.online.bioShare}{" "}
                      <code className="font-mono">{typeof window !== "undefined" ? window.location.origin : ""}/bio/{biz.slug}</code>{" "}
                      {t.online.bioBody}
                    </div>
                  )}

                  {/* Instagram tip */}
                  <div className="mt-2 rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 text-xs text-purple-800">
                    <span className="font-semibold">{t.online.instagramLabel}</span> {t.online.instagramBodyA}<strong>{t.online.instagramEdit}</strong>{t.online.instagramBodyB}<strong>{t.online.instagramWebsite}</strong>{t.online.instagramBodyC}
                  </div>
                  <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
                    <span className="font-semibold">{t.online.googleLabel}</span> {t.online.googleBodyA}<strong>{t.online.googleEdit}</strong>{t.online.googleBodyB}<strong>{t.online.googleWebsite}</strong>{t.online.googleBodyC}
                  </div>
                  <div className="mt-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-xs text-green-800">
                    <span className="font-semibold">{t.online.fbLabel}</span> {t.online.fbBodyA}<strong>{t.online.fbEdit}</strong>{t.online.fbBodyB}<strong>{t.online.fbAddButton}</strong>{t.online.fbBodyC}<strong>{t.online.fbBookNow}</strong>{t.online.fbBodyD}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <QrCode className="w-4 h-4 text-gray-700" />
                    <span className="text-sm font-semibold text-gray-900">{t.online.qrTitle}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">{t.online.qrDesc}</p>
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
                      <Download className="w-3.5 h-3.5" /> {t.online.downloadSvg}
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Braces className="w-4 h-4 text-gray-700" />
                    <span className="text-sm font-semibold text-gray-900">{t.online.embedTitle}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{t.online.embedDesc}</p>
                  <div className="flex items-start gap-2 bg-gray-900 rounded-xl px-4 py-3">
                    <code className="text-xs text-gray-100 flex-1 break-all font-mono">{embedSnippet}</code>
                    <button type="button" onClick={copyEmbed} aria-label={t.online.embedCopyAria} className="text-gray-400 hover:text-white transition-colors shrink-0 mt-0.5">
                      {embedCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t.online.quickStats}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t.online.publicId}</span>
                    <code className="text-gray-800 font-medium">{biz?.id}</code>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t.online.timezone}</span>
                    <span className="text-gray-800 font-medium">{biz?.timezone}</span>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{t.online.builderTitle}</h4>
                      <p className="text-xs text-gray-400">{t.online.builderSubtitle}</p>
                    </div>
                    <Field label={t.online.headline} htmlFor="set-headline">
                      <Input id="set-headline" value={(bookingSettings.headline as string) ?? ""} onChange={(e) => bf("headline", e.target.value)} placeholder={t.online.headlinePlaceholder.replace("{name}", biz?.name ?? t.online.usFallback)} />
                    </Field>
                    <Field label={t.online.intro} htmlFor="set-intro">
                      <textarea
                        id="set-intro"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-violet-200"
                        value={(bookingSettings.intro as string) ?? ""}
                        onChange={(e) => bf("intro", e.target.value)}
                        placeholder={t.online.introPlaceholder} />
                    </Field>
                    <Field label={t.online.seoTitle} htmlFor="set-seo-title">
                      <Input id="set-seo-title" value={(bookingSettings.seoTitle as string) ?? ""} onChange={(e) => bf("seoTitle", e.target.value)} placeholder={t.online.seoTitlePlaceholder.replace("{name}", biz?.name ?? t.online.businessFallback)} />
                    </Field>
                    <p className="text-xs text-gray-400">{t.online.brandingHintA}<button type="button" onClick={() => goSection("branding")} className="text-violet-600 hover:underline font-medium">{t.online.brandingHintLink}</button>.</p>
                    <Field label={t.online.seoDesc} htmlFor="set-seo-desc">
                      <Input id="set-seo-desc" value={(bookingSettings.seoDescription as string) ?? ""} onChange={(e) => bf("seoDescription", e.target.value)} placeholder={t.online.seoDescPlaceholder} />
                    </Field>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.online.livePreview}</p>
                    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: String(bookingSettings.brandColor ?? "#7C3AED") }} />
                      <h4 className="mt-4 text-base font-bold text-gray-900">{String(bookingSettings.headline || t.online.previewHeadlineFallback.replace("{name}", biz?.name ?? t.online.usFallback))}</h4>
                      <p className="mt-2 text-xs leading-relaxed text-gray-500">{String(bookingSettings.intro || biz?.cancellationPolicy || t.online.previewIntroFallback)}</p>
                      <div className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700">{t.online.previewServices}</div>
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
                { id: "default", style: "font-sans",   preview: "Aa" },
                { id: "modern",  style: "font-sans tracking-tight", preview: "Aa" },
                { id: "elegant", style: "font-serif",  preview: "Aa" },
                { id: "bold",    style: "font-sans font-black", preview: "Aa" },
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
                    <h3 className="text-sm font-semibold text-gray-900">{t.branding.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{t.branding.subtitle}</p>
                  </div>
                  <hr className="border-gray-100" />

                  {/* Brand color + WCAG checker */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Palette className="w-4 h-4 text-violet-500" /> {t.branding.brandColor}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.branding.brandColorDesc}</p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Native colour picker — opens OS colour wheel */}
                      <label className="relative cursor-pointer group">
                        <div className="w-12 h-12 rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden group-hover:border-violet-400 transition-colors"
                          style={{ backgroundColor: brandHex }} />
                        <input type="color" value={brandHex} onChange={(e) => bf("brandColor", e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" aria-label={t.branding.pickColorAria} />
                      </label>

                      {/* Hex text input */}
                      <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 bg-white">
                        <span className="text-sm text-gray-400 font-mono">#</span>
                        <input
                          type="text"
                          maxLength={6}
                          aria-label={t.branding.hexAria}
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
                        {t.branding.bookNow}
                      </button>
                    </div>

                    {/* WCAG Accessibility panel */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                      <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" /> {t.branding.wcagTitle}
                      </p>
                      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-lg bg-white border border-gray-100 p-2.5 text-center">
                          <p className="text-gray-400 mb-1">{t.branding.colorOnWhite}</p>
                          <p className="font-bold text-gray-900 tabular-nums">{onWhite.toFixed(1)}:1</p>
                          <span className={cn("text-[10px] font-semibold", wLabel.color)}>{wLabel.level}</span>
                        </div>
                        <div className="rounded-lg bg-white border border-gray-100 p-2.5 text-center">
                          <p className="text-gray-400 mb-1">{t.branding.colorOnDark}</p>
                          <p className="font-bold text-gray-900 tabular-nums">{onBlack.toFixed(1)}:1</p>
                          <span className={cn("text-[10px] font-semibold", bLabel.color)}>{bLabel.level}</span>
                        </div>
                        <div className="rounded-lg border border-gray-100 p-2.5 text-center"
                          style={{ backgroundColor: brandHex, color: bestText }}>
                          <p className="opacity-70 mb-1 text-[10px]">{t.branding.textOnButton}</p>
                          <p className="font-bold tabular-nums text-xs">{Math.max(whiteText, blackText).toFixed(1)}:1</p>
                          <span className="text-[10px] font-semibold opacity-90">{btnLabel.level}</span>
                        </div>
                      </div>
                      {!btnLabel.pass && (
                        <p className="text-[11px] text-amber-700 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          {t.branding.wcagWarn}
                        </p>
                      )}
                      {btnLabel.pass && (
                        <p className="text-[11px] text-emerald-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          {t.branding.wcagGood.replace("{level}", btnLabel.level)}
                        </p>
                      )}
                    </div>

                    {/* Colour palette shades */}
                    <div>
                      <p className="text-xs font-medium text-gray-600">{t.branding.shades}</p>
                      <p className="mb-3 mt-0.5 text-[11px] text-gray-400">{t.branding.shadesDesc}</p>
                      <div className="space-y-2.5">
                        {COLOR_FAMILIES.map((family) => (
                          <div key={family.name} className="grid grid-cols-[64px_1fr] items-center gap-2">
                            <span className="text-[11px] font-medium text-gray-500">{t.branding.colorNames[family.name]}</span>
                            <div className="grid grid-cols-5 gap-1.5">
                              {family.shades.map((hex, shadeIndex) => (
                                <button key={hex} type="button" title={t.branding.shadeTitle.replace("{name}", t.branding.colorNames[family.name]).replace("{n}", String(shadeIndex + 1)).replace("{hex}", hex)}
                                  onClick={() => bf("brandColor", hex)}
                                  className={cn("h-8 rounded-lg border-2 shadow-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-violet-300",
                                    brandHex.toLowerCase() === hex.toLowerCase() ? "border-gray-950 scale-105" : "border-white")}
                                  style={{ backgroundColor: hex }}
                                  aria-label={t.branding.shadeAria.replace("{name}", t.branding.colorNames[family.name]).replace("{n}", String(shadeIndex + 1)).replace("{hex}", hex)} />
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
                    <p className="text-sm font-semibold text-gray-800">{t.branding.tagline}</p>
                    <p className="text-xs text-gray-400">{t.branding.taglineDesc}</p>
                    <input
                      type="text"
                      maxLength={80}
                      aria-label={t.branding.taglineAria}
                      value={(bookingSettings.tagline as string) ?? ""}
                      onChange={(e) => bf("tagline", e.target.value)}
                      placeholder={t.branding.taglinePlaceholder}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200" />
                    <p className="text-[11px] text-gray-400 text-right">{((bookingSettings.tagline as string) ?? "").length}/80</p>
                  </div>

                  <hr className="border-gray-100" />

                  {/* Font selector — Pro+ */}
                  <div className={cn("space-y-3", !isPro && "opacity-70")}>
                    <div className="flex items-center gap-2">
                      <Type className="w-4 h-4 text-violet-500" />
                      <p className="text-sm font-semibold text-gray-800">{t.branding.fontTitle}</p>
                      {!isPro && <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">{t.branding.proPlus}</span>}
                    </div>
                    <p className="text-xs text-gray-400">{t.branding.fontDesc}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {FONTS.map((font) => (
                        <button key={font.id} type="button"
                          disabled={!isPro}
                          onClick={() => bf("fontFamily", font.id)}
                          className={cn("rounded-xl border-2 p-3 text-center transition-all",
                            fontVal === font.id ? "border-violet-500 bg-violet-50" : "border-gray-100 hover:border-gray-300 bg-white",
                            !isPro && "cursor-not-allowed")}>
                          <span className={cn("block text-2xl font-bold leading-tight text-gray-800 mb-1", font.style)}>{font.preview}</span>
                          <span className="text-[10px] font-medium text-gray-500">{t.branding.fonts[font.id]}</span>
                        </button>
                      ))}
                    </div>
                    {!isPro && <button type="button" onClick={() => promptUpgrade("PRO", t.branding.fontFeature)} className="text-xs font-semibold text-violet-600 hover:underline">{t.branding.fontUpgrade}</button>}
                  </div>

                  <hr className="border-gray-100" />

                  {/* Powered by toggle — Unlimited only */}
                  <div className={cn("flex flex-col gap-3 p-4 rounded-xl border sm:flex-row sm:items-center sm:justify-between", isUnlimited ? "border-gray-100 bg-gray-50" : "border-gray-100 bg-gray-50 opacity-75")}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800">{t.branding.removeWatermark}</p>
                        {!isUnlimited && <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">{t.branding.unlimited}</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{t.branding.removeWatermarkDesc}</p>
                    </div>
                    <button type="button"
                      onClick={() => isUnlimited ? bf("hidePouredBy", !bookingSettings.hidePouredBy) : promptUpgrade("UNLIMITED", t.branding.removeBrandingFeature)}
                      role="switch"
                      aria-checked={!!(bookingSettings.hidePouredBy && isUnlimited)}
                      aria-label={t.branding.removeWatermarkAria}
                      className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0 ml-4",
                        bookingSettings.hidePouredBy && isUnlimited ? "bg-violet-600" : "bg-gray-200")}>
                      <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                        bookingSettings.hidePouredBy && isUnlimited ? "translate-x-6" : "translate-x-1")} />
                    </button>
                  </div>

                  {/* Live preview */}
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{t.branding.pagePreview}</p>
                    <div className="rounded-xl overflow-hidden border border-gray-100">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100" style={{ backgroundColor: brandHex + "18" }}>
                        {biz?.logoUrl
                          ? <Image src={biz.logoUrl} alt="" width={24} height={24} className="w-6 h-6 rounded-lg object-cover shrink-0" />
                          : <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: brandHex }}>
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                            </div>
                        }
                        <span className="text-sm font-bold text-gray-900">{biz?.name ?? t.branding.businessFallback}</span>
                      </div>
                      <div className="p-4 bg-gray-50">
                        {!!bookingSettings.tagline && <p className="text-xs text-gray-500 italic mb-3">{String(bookingSettings.tagline)}</p>}
                        <p className="text-base font-bold text-gray-900 mb-3">{String(bookingSettings.headline || t.online.previewHeadlineFallback.replace("{name}", biz?.name ?? t.online.usFallback))}</p>
                        <button type="button" className="px-4 py-2 rounded-lg text-sm font-semibold shadow-sm"
                          style={{ backgroundColor: brandHex, color: bestText }}>{t.branding.continue}</button>
                      </div>
                    </div>
                    {!bookingSettings.hidePouredBy && (
                      <p className="text-center text-[10px] text-gray-400 mt-2">{t.branding.poweredByA}<span className="text-violet-500 font-medium">{t.branding.poweredByBrand}</span></p>
                    )}
                  </div>
                </div>
              );
            })()}

            {section === "locations" && (
              <div className="p-4 space-y-5 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{t.locations.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t.locations.subtitle}</p>
                </div>
                <FeatureError message={featureErrors.locations} onRetry={loadLocations} />
                <hr className="border-gray-100" />

                {!canManageLocations ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">{t.locations.limitTitle}</p>
                    <p className="text-xs text-amber-700 mt-1">{t.locations.limitBodyA}<strong>{t.locations.limitBodyBold}</strong>{t.locations.limitBodyB}</p>
                    <button type="button" onClick={() => { goSection("billing"); }} className="mt-2 text-xs font-semibold text-amber-800 underline">{t.locations.viewPlans}</button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {locations.length === 0 && <p className="text-xs text-gray-400">{t.locations.noExtra}</p>}
                      {locations.map((loc) => (
                        <div key={loc.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{loc.name}</p>
                            {loc.address && <p className="text-xs text-gray-400 truncate">{loc.address}</p>}
                            {!loc.active && <span className="text-xs text-amber-600 font-medium">{t.locations.inactive}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button"
                              onClick={async () => { try { await api.locations.update(bizId, loc.id, { active: !loc.active }); notifyLocationsChanged(); loadLocations(); } catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.failed); } }}
                              className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50">
                              {loc.active ? t.locations.deactivate : t.locations.activate}
                            </button>
                            <button type="button"
                              onClick={() => setLocationToRemove(loc)}
                              className="text-xs text-red-600 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50">
                              {t.locations.remove}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                      <p className="text-sm font-medium text-gray-700">{t.locations.addTitle}</p>
                      <Input placeholder={t.locations.namePlaceholder} aria-label={t.locations.nameAria} value={locationForm.name} onChange={(e) => setLocationForm((p) => ({ ...p, name: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
                      <Input placeholder={t.locations.addressPlaceholder} aria-label={t.locations.addressAria} value={locationForm.address} onChange={(e) => setLocationForm((p) => ({ ...p, address: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input placeholder={t.locations.phonePlaceholder} type="tel" aria-label={t.locations.phoneAria} value={locationForm.phone} onChange={(e) => setLocationForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />
                        <label htmlFor="loc-timezone" className="sr-only">{t.locations.timezoneSr}</label>
                        <select id="loc-timezone" value={locationForm.timezone} onChange={(e) => setLocationForm((p) => ({ ...p, timezone: e.target.value }))}
                          className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                          <option value="">{t.locations.sameTimezone}</option>
                          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
                        </select>
                      </div>
                      <Button type="button" size="sm" loading={locationBusy}
                        onClick={async () => {
                          if (!locationForm.name.trim()) { toast.error(t.toasts.locationNameRequired); return; }
                          setLocationBusy(true);
                          try {
                            await api.locations.create(bizId, { name: locationForm.name, address: locationForm.address || undefined, phone: locationForm.phone || undefined, timezone: locationForm.timezone || undefined });
                            setLocationForm({ name: "", address: "", phone: "", timezone: "" });
                            notifyLocationsChanged();
                            loadLocations();
                            toast.success(t.toasts.locationAdded);
                          } catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.locationAddFailed); }
                          finally { setLocationBusy(false); }
                        }}
                      >{t.locations.addButton}</Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {section === "payouts" && (
              <div className="p-4 space-y-5 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{t.payouts.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t.payouts.subtitle}</p>
                </div>
                <FeatureError message={featureErrors.connect} onRetry={loadConnect} />
                <hr className="border-gray-100" />

                {/* Pricing table */}
                <div className="rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{t.payouts.feeScheduleTitle}</p>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">{t.payouts.colPlan}</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">{t.payouts.colMonthly}</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">{t.payouts.colCardPresent}</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">{t.payouts.colCardNotPresent}</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">{t.payouts.colOnline}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: "FREE",      name: t.payouts.planFree,      mo: "$0",   cp: "2.6% + $0.15", cnp: "3.5% + $0.15", online: "3.3% + $0.30" },
                        { id: "BASIC",     name: t.payouts.planBasic,     mo: "$19",  cp: "2.5% + $0.15", cnp: "3.5% + $0.15", online: "2.9% + $0.30" },
                        { id: "PRO",       name: t.payouts.planPro,       mo: "$39",  cp: "2.4% + $0.15", cnp: "3.5% + $0.15", online: "2.9% + $0.00" },
                        { id: "UNLIMITED", name: t.payouts.planUnlimited, mo: "$79",  cp: "2.4% + $0.15", cnp: "3.5% + $0.15", online: "2.9% + $0.00" },
                      ].map((row) => (
                        <tr key={row.id} className={cn("border-b border-gray-50 last:border-0", plan === row.id && "bg-violet-50")}>
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{row.name}{plan === row.id && <span className="ml-1.5 text-violet-600">{t.payouts.current}</span>}</td>
                          <td className="px-4 py-2.5 text-gray-600">{row.mo}{t.payouts.perMonth}</td>
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
                  <p className="text-sm text-gray-400">{t.payouts.loading}</p>
                ) : !connectStatus ? (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-800">{t.payouts.unavailableTitle}</p>
                    <p className="mt-1 text-xs text-gray-500">{t.payouts.unavailableBody}</p>
                  </div>
                ) : !connectStatus.onboarded ? (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-violet-900">{t.payouts.connectTitle}</p>
                    <p className="text-xs text-violet-700">{t.payouts.connectBody}</p>
                    <ul className="text-xs text-violet-700 space-y-1 ml-3 list-disc">
                      <li><strong>{t.payouts.bulletHoldingLabel}</strong>{t.payouts.bulletHolding}</li>
                      <li><strong>{t.payouts.bulletFlexibleLabel}</strong>{t.payouts.bulletFlexible}</li>
                      <li><strong>{t.payouts.bulletInstantLabel}</strong>{t.payouts.bulletInstant}</li>
                    </ul>
                    <button type="button" disabled={connectBusy !== null}
                      onClick={async () => {
                        setConnectBusy("onboard");
                        try { const { url } = await api.connect.onboard(); window.location.assign(url); }
                        catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.onboardStartFailed); setConnectBusy(null); }
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                      {connectBusy === "onboard" ? t.payouts.redirecting : t.payouts.setupPayouts}
                    </button>
                  </div>
                ) : !connectStatus.chargesEnabled ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">{t.payouts.verifyingTitle}</p>
                        <p className="text-xs text-amber-700 mt-1">{t.payouts.verifyingBody}</p>
                        <p className="text-xs text-amber-600 mt-2">{t.payouts.verifyingHeld}</p>
                      </div>
                    </div>
                    <button type="button" disabled={connectBusy !== null}
                      onClick={async () => {
                        setConnectBusy("dashboard");
                        try { const { url } = await api.connect.dashboard(); window.open(url, "_blank", "noopener,noreferrer"); }
                        catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.dashboardOpenFailed); }
                        finally { setConnectBusy(null); }
                      }}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 border border-amber-300 rounded-lg px-3 py-2 hover:bg-amber-100 disabled:opacity-60 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {connectBusy === "dashboard" ? t.payouts.opening : t.payouts.checkStatus}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">{t.payouts.connectedTitle}</p>
                        <p className="text-xs text-emerald-700 mt-0.5">{t.payouts.connectedBody}</p>
                      </div>
                    </div>

                    {/* Balance */}
                    {connectStatus.available.length > 0 && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-gray-100 bg-white p-4">
                          <p className="text-xs text-gray-400 mb-1">{t.payouts.availableBalance}</p>
                          {connectStatus.available.map((b) => (
                            <p key={b.currency} className="text-xl font-bold text-gray-900">${(b.amount / 100).toFixed(2)} <span className="text-sm font-normal text-gray-400">{b.currency.toUpperCase()}</span></p>
                          ))}
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-white p-4">
                          <p className="text-xs text-gray-400 mb-1">{t.payouts.pending}</p>
                          {connectStatus.pending.map((b) => (
                            <p key={b.currency} className="text-xl font-bold text-gray-500">${(b.amount / 100).toFixed(2)} <span className="text-sm font-normal text-gray-400">{b.currency.toUpperCase()}</span></p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Manual payout */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                      <p className="text-sm font-medium text-gray-700">{t.payouts.withdrawTitle}</p>
                      <div className="flex gap-2">
                        <Input
                          type="number" min="1" step="0.01" placeholder={t.payouts.amountPlaceholder}
                          aria-label={t.payouts.amountAria}
                          value={payoutAmount} onChange={(e) => {
                            setPayoutAmount(e.target.value);
                            payoutIdempotencyKey.current = null;
                          }}
                          className="flex-1"
                        />
                        <Button type="button" loading={connectBusy === "payout"}
                          onClick={async () => {
                            const cents = Math.round(parseFloat(payoutAmount) * 100);
                            if (!cents || cents < 100) { toast.error(t.toasts.payoutMinimum); return; }
                            payoutIdempotencyKey.current ??= crypto.randomUUID();
                            setConnectBusy("payout");
                            try {
                              await api.connect.payout(cents, false, biz?.currency?.toLowerCase(), payoutIdempotencyKey.current);
                              toast.success(t.toasts.payoutInitiated);
                              payoutIdempotencyKey.current = null;
                              setPayoutAmount(""); loadConnect();
                            } catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.payoutFailed); }
                            finally { setConnectBusy(null); }
                          }}
                        >{t.payouts.withdraw}</Button>
                      </div>
                      <p className="text-xs text-gray-400">{t.payouts.withdrawHint}</p>
                    </div>

                    <button type="button" disabled={connectBusy !== null}
                      onClick={async () => {
                        setConnectBusy("dashboard");
                        try { const { url } = await api.connect.dashboard(); window.open(url, "_blank", "noopener,noreferrer"); }
                        catch (e) { toast.error(e instanceof Error ? e.message : t.toasts.dashboardOpenFailed); }
                        finally { setConnectBusy(null); }
                      }}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-violet-600 border border-violet-300 rounded-lg px-3 py-2 hover:bg-violet-50 disabled:opacity-60 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {connectBusy === "dashboard" ? t.payouts.opening : t.payouts.openExpress}
                    </button>
                  </div>
                )}
              </div>
            )}

            {section === "security" && (
              <div className="p-4 space-y-4 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{t.security.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t.security.subtitle}</p>
                </div>
                <hr className="border-gray-100" />

                <div>
                  <label htmlFor="set-2fa-password" className="block text-xs font-medium text-gray-700 mb-1.5">{t.security.currentPassword}</label>
                  <Input
                    id="set-2fa-password"
                    type="password"
                    autoComplete="current-password"
                    value={twoFAPassword}
                    onChange={(e) => setTwoFAPassword(e.target.value)}
                    placeholder={t.security.currentPasswordPlaceholder}
                  />
                </div>

                <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t.security.twoFATitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.security.twoFADesc}
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
                    <p className="text-xs font-medium text-gray-700 mb-2">{t.security.sendCodeBy}</p>
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
                          {m === "EMAIL" ? t.security.methodEmail : t.security.methodSms}
                        </button>
                      ))}
                    </div>
                    {twoFAMethod === "SMS" && (
                      <p className="text-xs text-amber-600 mt-2">
                        {t.security.smsWarning}
                      </p>
                    )}
                  </div>
                )}

                {recoveryCodes && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">{t.security.recoveryTitle}</p>
                    <p className="text-xs text-amber-700 mt-0.5 mb-3">
                      {t.security.recoveryBody}
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 font-mono text-sm text-gray-800 bg-white rounded-lg border border-amber-100 p-3 min-[400px]:grid-cols-2">
                      {recoveryCodes.map((c) => <span key={c}>{c}</span>)}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button type="button"
                        onClick={() => { navigator.clipboard?.writeText(recoveryCodes.join("\n")).then(() => toast.success(t.toasts.recoveryCopied)).catch(() => toast.error(t.toasts.recoveryCopyFailed)); }}
                        className="text-xs font-semibold text-amber-800 border border-amber-300 rounded-lg px-3 py-1.5 hover:bg-amber-100">
                        {t.security.copyCodes}
                      </button>
                      <button type="button" onClick={() => setRecoveryCodes(null)}
                        className="text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                        {t.security.savedThem}
                      </button>
                    </div>
                  </div>
                )}

                <hr className="border-gray-100" />
                <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t.security.passwordTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.security.passwordDesc}</p>
                  </div>
                  <a href="/change-password"
                    className="text-xs font-semibold text-violet-600 border border-violet-300 rounded-lg px-3 py-1.5 hover:bg-violet-50 transition-colors shrink-0">
                    {t.security.changePassword}
                  </a>
                </div>
              </div>
            )}

            {section === "billing" && (
              <div className="p-4 space-y-5 sm:p-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{t.billing.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t.billing.subtitle}</p>
                </div>
                <FeatureError message={featureErrors.subscription || featureErrors.referrals} onRetry={() => {
                  loadSubscription().catch(() => {});
                  api.referrals.get()
                    .then((r) => { setMyReferral({ code: r.code, referredCount: r.referredCount }); clearFeatureError("referrals"); })
                    .catch((e) => recordFeatureError("referrals", e, t.featureErrors.referrals));
                }} />
                <hr className="border-gray-100" />

                <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {t.billing.currentPlan.replace("{plan}", (subscription?.plan ?? biz?.plan ?? "FREE").toLowerCase().replace(/^./, (c) => c.toUpperCase()))}
                      </p>
                      {billingBusy === "confirming" ? (
                        <p className="mt-1 text-xs font-medium text-violet-700">{t.billing.confirming}</p>
                      ) : subscription?.status === "PAST_DUE" ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">{t.billing.pastDue}</p>
                      ) : subscription?.cancelAtPeriodEnd ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          {t.billing.cancelScheduledA.replace("{date}", subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : t.billing.endOfPeriod)}
                        </p>
                      ) : (subscription?.plan ?? biz?.plan ?? "FREE") !== "FREE" ? (
                        <p className="mt-1 text-xs text-gray-600">
                          {subscription?.currentPeriodEnd ? t.billing.renewsOn.replace("{date}", new Date(subscription.currentPeriodEnd).toLocaleDateString()) : t.billing.renewsEach}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-600">{t.billing.noRecurring}</p>
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
                    <p className="text-sm font-semibold text-amber-900">{t.billing.haveReferral}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{t.billing.haveReferralDesc}</p>
                    <input
                      aria-label={t.billing.referralAria}
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                      placeholder={t.billing.referralPlaceholder}
                      className="mt-2 w-full sm:w-64 text-sm border border-amber-300 rounded-lg px-3 py-2 bg-white uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  {myReferral && (
                    <div className="border-t border-amber-200 pt-3">
                      <p className="text-sm font-semibold text-amber-900">{t.billing.sharePulse}</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        {t.billing.sharePulseBody.replace("{count}", myReferral.referredCount > 0 ? t.billing.sharePulseCount.replace("{count}", String(myReferral.referredCount)) : "")}
                      </p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <code className="text-xs font-bold text-amber-900 bg-white border border-amber-300 rounded-lg px-3 py-2 break-all">
                          https://www.pulseappointments.com/register?ref={myReferral.code}
                        </code>
                        <button type="button"
                          onClick={() => { navigator.clipboard.writeText(`https://www.pulseappointments.com/register?ref=${myReferral.code}`).then(() => { setRefCopied(true); setTimeout(() => setRefCopied(false), 1500); }).catch(() => toast.error(t.toasts.copyLinkFailed)); }}
                          className="w-fit text-xs font-semibold text-amber-700 border border-amber-300 rounded-lg px-2.5 py-2 hover:bg-amber-100 transition-colors">
                          {refCopied ? t.billing.copied : t.billing.copyLink}
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-amber-700">{t.billing.codeLabel} <span className="font-semibold tracking-wide">{myReferral.code}</span></p>
                    </div>
                  )}
                </div>

                <div className="mb-4 inline-flex rounded-xl border border-gray-200 bg-white p-1">
                  {[
                    { id: "month" as const, label: t.billing.monthly },
                    { id: "year" as const, label: t.billing.annual, suffix: t.billing.twoMonthsFree },
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
                    { id: "FREE", planKey: "free" as const, monthlyPrice: 0, annualPrice: 0, disabled: true },
                    { id: "BASIC", planKey: "basic" as const, monthlyPrice: 19, annualPrice: 190, recommended: true, disabled: false },
                    { id: "PRO", planKey: "pro" as const, monthlyPrice: 39, annualPrice: 390, highlight: true, disabled: false },
                    { id: "UNLIMITED", planKey: "unlimited" as const, monthlyPrice: 79, annualPrice: 790, disabled: false },
                  ].map((planRow) => {
                    const plan = {
                      ...planRow,
                      name: t.billing.plans[planRow.planKey].name,
                      desc: t.billing.plans[planRow.planKey].desc,
                      features: t.billing.plans[planRow.planKey].features,
                      cta: t.billing.plans[planRow.planKey].cta,
                      recommended: "recommended" in planRow ? planRow.recommended : false,
                      highlight: "highlight" in planRow ? planRow.highlight : false,
                    };
                    return (
                    <div key={plan.id} className={cn(
                      "rounded-2xl border-2 p-5 relative",
                      plan.recommended ? "border-emerald-500 bg-emerald-50/50"
                        : plan.highlight ? "border-violet-500 bg-violet-50"
                        : "border-gray-100 bg-white",
                    )}>
                      {plan.recommended && (
                        <span className="absolute -top-2.5 left-5 text-xs font-bold text-white bg-emerald-600 px-3 py-0.5 rounded-full">
                          {t.billing.recommended}
                        </span>
                      )}
                      {plan.highlight && !plan.recommended && (
                        <span className="absolute -top-2.5 left-5 text-xs font-bold text-white bg-violet-600 px-3 py-0.5 rounded-full">
                          {t.billing.mostPopular}
                        </span>
                      )}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-gray-900">
                              {plan.monthlyPrice === 0 ? "$0" : billingInterval === "year" ? `$${plan.annualPrice}` : `$${plan.monthlyPrice}`}
                            </span>
                            <span className="text-sm text-gray-400">{plan.monthlyPrice === 0 ? t.billing.perMonth : billingInterval === "year" ? t.billing.perYear : t.billing.perMonth}</span>
                          </div>
                          <p className="font-semibold text-gray-800 mt-0.5">{plan.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {plan.desc}
                            {billingInterval === "year" && plan.monthlyPrice > 0 ? t.billing.annualNote : ""}
                          </p>
                        </div>
                        {(() => {
                          const RANK: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2, UNLIMITED: 3 };
                          const currentPlan = biz?.plan ?? "FREE";
                          const isCurrent = currentPlan === plan.id;
                          const isDowngrade = (RANK[plan.id] ?? 0) < (RANK[currentPlan] ?? 0);
                          const canBuy = (plan.id === "BASIC" || plan.id === "PRO" || plan.id === "UNLIMITED") && !isCurrent && !isDowngrade;
                          const label = isCurrent ? t.billing.currentPlanBtn
                            : billingBusy === plan.id ? t.billing.redirecting
                            : isDowngrade ? t.billing.manageDowngrade.replace("{name}", plan.name)
                            : plan.cta;
                          return (
                            <button
                              type="button"
                              disabled={isCurrent || billingBusy !== null}
                              onClick={() => {
                                if (canBuy) upgrade(plan.id as "BASIC" | "PRO" | "UNLIMITED");
                                else if (isDowngrade && subscription?.hasBilling) manageBilling();
                                else if (!isCurrent) toast.info(t.toasts.downgradeInfo);
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
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-xs text-gray-600">
                            <CheckCircle2 className={cn("w-3.5 h-3.5 shrink-0", plan.highlight && !plan.recommended ? "text-violet-500" : "text-emerald-500")} />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    );
                  })}
                </div>

                {(biz?.plan ?? "FREE") !== "FREE" && (
                  <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{t.billing.portalTitle}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.billing.portalDesc}</p>
                    </div>
                    <button type="button" onClick={manageBilling} disabled={billingBusy !== null}
                      className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 disabled:opacity-60 transition-colors shrink-0">
                      {billingBusy === "portal" ? t.payouts.opening : t.billing.manageBilling}
                    </button>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                  <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">{t.billing.smsProTitle}</p>
                    <p className="text-xs text-amber-600 mt-0.5">{t.billing.smsProBody}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/95 px-4 py-3 backdrop-blur sm:px-6">
              {section !== "billing" && section !== "security" && section !== "payouts" && section !== "locations" && section !== "calendar" ? (
                <>
                  <p className={cn("text-xs", dirty ? "text-amber-700" : "text-gray-400")}>
                    {dirty ? t.footerDirty : t.footerClean}
                  </p>
                  <Button type="submit" loading={saving} disabled={!dirty} size="md">
                    {t.saveChanges}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-gray-400">
                  {t.footerExternal}
                </p>
              )}
            </div>
          </form>
        </div>

      </div>

    </div>

    <ConfirmDialog
      open={locationToRemove !== null}
      title={t.locations.removeTitle}
      description={t.locations.removeDesc.replace("{name}", locationToRemove?.name ?? "")}
      confirmLabel={t.locations.remove}
      variant="destructive"
      onConfirm={async () => {
        if (!locationToRemove) return;
        try {
          await api.locations.remove(bizId, locationToRemove.id);
          notifyLocationsChanged();
          loadLocations();
          toast.success(t.toasts.locationRemoved);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t.toasts.failed);
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
