"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Check, Globe, Clock, DollarSign, Building2, ChevronRight, CreditCard, Zap, CheckCircle2, Bell, ShieldCheck, CalendarDays, Plus, Trash2, ClipboardList, AlertTriangle, MapPin, Banknote, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import { api, Business, VerificationStatus, IntakeQuestion, Location } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ImageUpload } from "@/components/ImageUpload";
import { cn, formatPhoneInput } from "@/lib/utils";

const TIMEZONES = [
  "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "America/Anchorage","Pacific/Honolulu","America/Toronto","America/Vancouver",
  "America/Edmonton","America/Winnipeg","America/Regina","America/Halifax",
  "America/St_Johns","America/Whitehorse",
  "Europe/London","Europe/Paris","Europe/Berlin","Asia/Dubai","Asia/Kolkata",
  "Asia/Singapore","Asia/Tokyo","Australia/Sydney","Pacific/Auckland",
];

type Section = "profile" | "locations" | "booking" | "calendar" | "payments" | "payouts" | "online" | "notifications" | "security" | "billing";

const SECTIONS: { id: Section; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "profile",       label: "Business profile",   icon: Building2,   desc: "Name, contact info, timezone" },
  { id: "locations",     label: "Locations",          icon: MapPin,      desc: "Manage multiple business locations" },
  { id: "booking",       label: "Booking policies",   icon: Clock,       desc: "Notice, cancellations, advance limits" },
  { id: "calendar",      label: "Calendar sync",      icon: CalendarDays, desc: "Sync bookings to Google Calendar" },
  { id: "payments",      label: "Payments & fees",    icon: DollarSign,  desc: "Deposits, no-show fees" },
  { id: "payouts",       label: "Payouts",            icon: Banknote,    desc: "Connect bank account & withdraw" },
  { id: "online",        label: "Online booking",     icon: Globe,       desc: "Booking page link, availability" },
  { id: "notifications", label: "Notifications",      icon: Bell,        desc: "Emails & SMS sent to clients" },
  { id: "security",      label: "Security",           icon: ShieldCheck, desc: "Two-factor sign-in, password" },
  { id: "billing",       label: "Billing & plan",     icon: CreditCard,  desc: "Subscription plan, upgrade" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
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

function PolicyNumberInput({ value, min = 0, unit, onChange }: {
  value: number; min?: number; unit: "hours" | "days"; onChange: (minutes: number) => void;
}) {
  const multiplier = unit === "days" ? 1440 : 60;
  const safe = Math.max(min, Math.floor(Number.isFinite(value) ? value : min));
  const displayValue = Math.max(min / multiplier, safe / multiplier);

  return (
    <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <Input
        type="number"
        min={min / multiplier}
        step={unit === "days" ? 1 : 1}
        value={Number.isInteger(displayValue) ? displayValue : Number(displayValue.toFixed(1))}
        onChange={(e) => onChange(Math.max(min, Math.round((Number(e.target.value) || 0) * multiplier)))}
        className="h-8 w-20 border-0 bg-transparent p-0 text-base font-semibold tabular-nums shadow-none focus-visible:ring-0"
      />
      <span className="ml-2 text-sm font-medium text-gray-500">{unit}</span>
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
        {questions.map((q) => (
          <div key={q.id} className="flex items-center gap-2">
            <Input value={q.label} placeholder="e.g. Any allergies or sensitivities?"
              onChange={(e) => update(q.id, { label: e.target.value })} className="flex-1" />
            <button type="button" onClick={() => update(q.id, { required: !q.required })}
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

export default function SettingsPage() {
  const [biz, setBiz]       = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [copied, setCopied]   = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [section, setSection] = useState<Section>("profile");
  const [form, setForm]       = useState<Partial<Business>>({});

  const searchParams = useSearchParams();

  const user = getUser();
  const bizId = user?.businessId ?? "";

  // Two-factor: seeded from the session, updated optimistically on toggle.
  const [twoFA, setTwoFA] = useState<boolean>(user?.twoFactorEnabled ?? false);
  const [twoFAMethod, setTwoFAMethod] = useState<"EMAIL" | "SMS">(user?.twoFactorMethod ?? "EMAIL");
  const [twoFASaving, setTwoFASaving] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null); // shown once after enabling

  async function saveTwoFactor(enabled: boolean, method: "EMAIL" | "SMS") {
    setTwoFASaving(true);
    const prev = { enabled: twoFA, method: twoFAMethod };
    setTwoFA(enabled); setTwoFAMethod(method);
    try {
      const res = await api.auth.setTwoFactor(enabled, method);
      if (res.user) {
        setTwoFA(!!res.user.twoFactorEnabled);
        setTwoFAMethod(res.user.twoFactorMethod ?? method);
      }
      if (res.recoveryCodes?.length) setRecoveryCodes(res.recoveryCodes);
      if (!enabled) setRecoveryCodes(null);
      toast.success(enabled ? "Two-factor sign-in enabled" : "Two-factor sign-in turned off");
    } catch (err) {
      setTwoFA(prev.enabled); setTwoFAMethod(prev.method); // roll back
      toast.error(err instanceof Error ? err.message : "Could not update two-factor");
    } finally {
      setTwoFASaving(false);
    }
  }

  useEffect(() => {
    if (!bizId) {
      setLoading(false);
      return;
    }
    api.business.get(bizId)
      .then((b) => { setBiz(b); setForm(b); })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, [bizId]);

  const f = (k: keyof Business, v: unknown) => setForm((p) => ({ ...p, [k]: v }));
  const bookingSettings = (form.bookingPageSettings ?? {}) as Record<string, unknown>;
  const notificationSettings = (form.notificationSettings ?? {}) as NonNullable<Business["notificationSettings"]>;
  const nf = (k: keyof NonNullable<Business["notificationSettings"]>, v: boolean) => setForm((p) => ({
    ...p,
    notificationSettings: { ...((p.notificationSettings ?? {}) as Record<string, unknown>), [k]: v },
  }));
  const bf = (k: string, v: unknown) => setForm((p) => ({
    ...p,
    bookingPageSettings: { ...((p.bookingPageSettings ?? {}) as Record<string, unknown>), [k]: v },
  }));

  const [billingBusy, setBillingBusy] = useState<string | null>(null);
  const [referralInput, setReferralInput] = useState("");
  const [myReferral, setMyReferral] = useState<{ code: string; referredCount: number } | null>(null);
  const [refCopied, setRefCopied] = useState(false);

  // Locations
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationForm, setLocationForm] = useState({ name: "", address: "", phone: "", timezone: "" });
  const [locationBusy, setLocationBusy] = useState(false);
  function loadLocations() {
    if (!bizId) return;
    api.locations.list(bizId).then(setLocations).catch(() => {});
  }
  useEffect(() => { loadLocations(); }, [bizId]);

  // Stripe Connect / Payouts
  type ConnectStatus = { onboarded: boolean; accountId: string | null; available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] };
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectBusy, setConnectBusy] = useState<string | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  function loadConnect() {
    api.connect.status().then(setConnectStatus).catch(() => {});
  }
  useEffect(() => { loadConnect(); }, []);

  // Load this business's own referral code + count.
  useEffect(() => {
    api.referrals.get().then((r) => setMyReferral({ code: r.code, referredCount: r.referredCount })).catch(() => {});
  }, []);

  // Business verification status.
  const [verif, setVerif] = useState<{ status: VerificationStatus; note: string | null } | null>(null);
  const [verifBusy, setVerifBusy] = useState(false);
  const [verificationForm, setVerificationForm] = useState({
    legalName: "", address: "", phone: "", governmentIdUrl: "", registrationDocUrl: "",
  });
  useEffect(() => {
    if (!bizId) return;
    api.verification.status(bizId).then((v) => {
      setVerif({ status: v.verificationStatus, note: v.verificationNote });
      setVerificationForm({
        legalName: v.verificationLegalName ?? "",
        address: v.verificationAddress ?? "",
        phone: v.verificationPhone ?? "",
        governmentIdUrl: v.verificationGovernmentIdUrl ?? "",
        registrationDocUrl: v.verificationDocUrl ?? "",
      });
    }).catch(() => {});
  }, [bizId]);
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
  function loadCal() { api.calendarSync.status().then(setCal).catch(() => {}); }
  useEffect(() => { loadCal(); }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("calendar");
    if (p === "connected") { toast.success("Google Calendar connected"); loadCal(); window.history.replaceState({}, "", "/dashboard/settings"); }
    else if (p === "error") { toast.error("Could not connect Google Calendar"); window.history.replaceState({}, "", "/dashboard/settings"); }
  }, []);
  async function connectCal() {
    try { const { url } = await api.calendarSync.connect(); window.location.assign(url); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not start Google connect"); }
  }
  async function disconnectCal() {
    try { await api.calendarSync.disconnect(); toast.success("Google Calendar disconnected"); loadCal(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not disconnect"); }
  }

  // Toast the result of a returning Stripe Checkout, then reload the plan.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("billing");
    if (p === "success") { toast.success("Subscription updated"); if (bizId) api.business.get(bizId).then(setBiz).catch(() => {}); }
    else if (p === "cancel") { toast.info("Checkout canceled"); }
    if (p) window.history.replaceState({}, "", "/dashboard/settings");
  }, [bizId]);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && SECTIONS.some((s) => s.id === tab)) setSection(tab as Section);
  }, []);

  useEffect(() => {
    const connect = searchParams.get("connect");
    if (connect === "success") {
      loadConnect();
      toast.success("Stripe account connected successfully — you can now accept payouts.");
      setSection("payouts");
    } else if (connect === "refresh") {
      // Auto-restart onboarding
      api.connect.onboard().then(({ url }) => window.location.assign(url)).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function upgrade(plan: "BASIC" | "PRO") {
    setBillingBusy(plan);
    try {
      const result = await api.subscriptions.checkout(plan, referralInput);
      if (result.url) window.location.assign(result.url);
      else {
        toast.success(`Switched to ${plan}. Stripe applied the prorated difference.`);
        if (bizId) api.business.get(bizId).then((b) => { setBiz(b); setForm(b); }).catch(() => {});
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
    if (!bizId) return;
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
        cancellationPolicy: String(form.cancellationPolicy ?? "").trim() || undefined,
      };
      const updated = await api.business.update(bizId, payload);
      setBiz(updated);
      setForm(updated);
      toast.success("Settings saved");
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  function copyUrl() {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <LoadingSpinner />;

  const bookingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/b/${biz?.id ?? ""}`;
  const embedOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const embedSnippet = `<script src="${embedOrigin}/embed.js" data-business-id="${biz?.id ?? ""}" async></script>`;
  const plan = biz?.plan ?? "FREE";
  const isPro = plan === "PRO";
  const isPaid = plan === "BASIC" || plan === "PRO";
  function promptUpgrade(target: "BASIC" | "PRO", feature: string) {
    toast.info(`${feature} requires ${target === "BASIC" ? "Basic or Pro" : "Pro"}.`);
    setSection("billing");
  }
  function copyEmbed() {
    navigator.clipboard.writeText(embedSnippet);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2000);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-400 mt-0.5">Manage your business profile and booking preferences</p>
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

      <div className="flex flex-col md:flex-row gap-5">

        {/* Mobile tab bar — hidden on md+ */}
        <div className="md:hidden mb-4 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                  section === s.id ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                <s.icon className="w-4 h-4" />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Left nav */}
        <aside className="hidden md:block w-56 shrink-0">
          <nav className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {SECTIONS.map(({ id, label, icon: Icon, desc }) => (
              <button key={id} onClick={() => setSection(id)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-gray-50 last:border-0 transition-colors group",
                  section === id ? "bg-violet-50" : "hover:bg-gray-50",
                )}>
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mt-0.5 shrink-0",
                  section === id ? "bg-violet-100" : "bg-gray-100 group-hover:bg-gray-200")}>
                  <Icon className={cn("w-4 h-4", section === id ? "text-violet-600" : "text-gray-500")} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", section === id ? "text-violet-700" : "text-gray-700")}>{label}</p>
                  <p className="text-xs text-gray-400 leading-tight mt-0.5 truncate">{desc}</p>
                </div>
                <ChevronRight className={cn("w-3.5 h-3.5 mt-1 shrink-0", section === id ? "text-violet-400" : "text-gray-300")} />
              </button>
            ))}
          </nav>
        </aside>

        {/* Right panel */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <form onSubmit={save}>

            {section === "profile" && (
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Business profile</h3>
                  <p className="text-xs text-gray-400 mt-0.5">This information appears on your booking page.</p>
                </div>
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
                              <Input placeholder="Full business name" value={verificationForm.legalName} onChange={(e) => setVerificationForm((p) => ({ ...p, legalName:e.target.value }))} />
                              <Input placeholder="Business address" value={verificationForm.address} onChange={(e) => setVerificationForm((p) => ({ ...p, address:e.target.value }))} />
                              <Input placeholder="Phone number" type="tel" value={verificationForm.phone} onChange={(e) => setVerificationForm((p) => ({ ...p, phone:e.target.value }))} />
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
                    f("logoUrl", url ?? "");
                    // Persist the logo on its own so it can't be lost to an unrelated
                    // invalid field elsewhere in the settings form.
                    if (!bizId) return;
                    try { await api.business.update(bizId, { logoUrl: url ?? "" }); toast.success(url ? "Logo saved" : "Logo removed"); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save logo"); }
                  }} />
                </Field>
                <Field label="Business name">
                  <Input value={(form.name as string) ?? ""} onChange={(e) => f("name", e.target.value)} placeholder="e.g. Paws & Claws Grooming" />
                </Field>
                <Field label="Contact email">
                  <Input type="email" value={(form.email as string) ?? ""} onChange={(e) => f("email", e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Phone">
                    <Input type="tel" placeholder="+1 (416) 555-0123" value={(form.phone as string) ?? ""} onChange={(e) => f("phone", formatPhoneInput(e.target.value))} />
                  </Field>
                  <Field label="Timezone">
                    <select value={(form.timezone as string) ?? "America/New_York"} onChange={(e) => f("timezone", e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Address">
                    <Input value={(form.address as string) ?? ""} onChange={(e) => f("address", e.target.value)} placeholder="123 Main St, City, State" />
                  </Field>
                  <Field label="Currency">
                    <select value={(form.currency as string) ?? "CAD"} onChange={(e) => f("currency", e.target.value)}
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
                  <Field label="Thank-you message">
                    <Input value={(form.postVisitMessage as string) ?? ""} onChange={(e) => f("postVisitMessage", e.target.value)} placeholder="Thanks for visiting. We hope to see you again soon." />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["websiteUrl", "instagramUrl", "facebookUrl", "tiktokUrl"] as const).map((key) => (
                      <Field key={key} label={key.replace("Url", "").replace(/^./, (c) => c.toUpperCase())}>
                        <Input type="url" value={(form[key] as string) ?? ""} onChange={(e) => f(key, e.target.value)} placeholder="https://" />
                      </Field>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {section === "booking" && (
              <div className="p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Booking policies</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Set the client booking rules that protect your calendar.</p>
                </div>
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
                      desc: "How many days before the appointment clients can still change it themselves.",
                      value: (form.cancellationWindowMinutes as number) ?? (((form.cancellationWindowHours as number) ?? 24) * 60),
                      min: 0,
                      unit: "days" as const,
                      key: "cancellationWindowMinutes" as const,
                    },
                  ].map((item) => (
                    <div key={item.key} className="grid gap-3 border-b border-gray-100 p-4 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500">{item.desc}</p>
                      </div>
                      <div className="sm:text-right">
                        <PolicyNumberInput value={item.value} min={item.min} unit={item.unit} onChange={(minutes) => f(item.key, minutes)} />
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

                <Field label="Policy clients accept before booking">
                  <textarea
                    className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-violet-200"
                    value={(form.cancellationPolicy as string) ?? ""}
                    onChange={(e) => f("cancellationPolicy", e.target.value)}
                    placeholder="Appointments cancelled within 24 hours of the scheduled time may be subject to a cancellation fee…" />
                  <p className="text-xs text-gray-400 mt-1">Shown during checkout on every business-specific booking link.</p>
                </Field>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Client self-reschedule</p>
                    <p className="text-xs text-gray-400 mt-0.5">Clients can move appointments from their secure manage link when outside your policy window.</p>
                  </div>
                  <button type="button" onClick={() => f("allowClientReschedule", !form.allowClientReschedule)}
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.allowClientReschedule ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.allowClientReschedule ? "translate-x-6" : "translate-x-1")} />
                  </button>
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
                      value={(form.taxRatePercent as number) ?? 0}
                      onChange={(e) => f("taxRatePercent", Number(e.target.value))}
                      className="bg-white text-base font-semibold" />
                    <span className="text-sm font-medium text-gray-500">% tax</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">Saved with the section below.</p>
                </div>
              </div>
            )}

            {section === "calendar" && (
              <div className="p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Calendar sync</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Push confirmed bookings to your Google Calendar automatically.</p>
                </div>
                {!cal ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : !cal.configured ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">Not available yet</p>
                    <p className="text-xs text-amber-700 mt-0.5">Google Calendar sync isn’t enabled on the server. Contact support to turn it on.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-100 bg-white p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex items-center gap-3">
                      <span className={cn("inline-flex w-9 h-9 rounded-lg items-center justify-center shrink-0", cal.connected ? "bg-green-50" : "bg-violet-50")}>
                        <CalendarDays className={cn("w-4 h-4", cal.connected ? "text-green-600" : "text-violet-600")} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Google Calendar</p>
                        {cal.connected ? (
                          <p className="text-xs text-gray-500 mt-0.5">Connected{cal.email ? ` as ${cal.email}` : ""} — bookings sync to your calendar, and personal events on it automatically block those times from booking.</p>
                        ) : (
                          <p className="text-xs text-gray-500 mt-0.5">Connect so confirmed bookings appear on your Google Calendar.</p>
                        )}
                      </div>
                    </div>
                    {cal.connected ? (
                      <button type="button" onClick={disconnectCal}
                        className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 transition-colors shrink-0">Disconnect</button>
                    ) : (
                      <button type="button" onClick={connectCal}
                        className="text-xs font-semibold text-white bg-violet-600 rounded-lg px-3 py-2 hover:bg-violet-700 transition-colors shrink-0">Connect</button>
                    )}
                  </div>
                )}

                {/* iCal feed — works regardless of Google sync status */}
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-start gap-3">
                    <Download className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">iCal feed (fallback)</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Subscribe to your appointments in any calendar app — Apple Calendar, Outlook, or any webcal-compatible app. Works even without Google Calendar connected. Confirmation emails also include a .ics calendar invite.
                      </p>
                      <a
                        href={api.calendarSync.icalFeedUrl()}
                        download="pulse-appointments.ics"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:underline"
                      >
                        <Download className="w-3 h-3" /> Download / subscribe to iCal feed
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === "payments" && (
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Payments &amp; fees</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Deposits and manual charges are Basic+. Automatic saved-card fees are Pro.</p>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-900">Stripe payments</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-md">Deposits, saved cards, fees, refunds, receipts, and subscription billing are processed securely by Stripe. Card details never pass through Pulse servers.</p>
                </div>

                <hr className="border-gray-100" />
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
                <div className={cn("flex items-center justify-between p-4 rounded-xl border", isPaid ? "border-gray-100 bg-gray-50" : "border-gray-100 bg-gray-50")}>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Require deposit at booking</p>
                    <p className="text-xs text-gray-400 mt-0.5">Collect a partial payment when clients book online. Basic+</p>
                  </div>
                  <button type="button" onClick={() => isPaid ? f("requireDeposit", !form.requireDeposit) : promptUpgrade("BASIC", "Deposits")}
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.requireDeposit ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.requireDeposit ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>
                {isPaid && form.requireDeposit && (
                  <Field label="Deposit percentage">
                    <div className="flex items-center gap-2">
                      <Input type="number" min={1} max={100} value={(form.depositPercent as number) ?? 25}
                        onChange={(e) => f("depositPercent", Number(e.target.value))} />
                      <span className="text-sm text-gray-500 shrink-0">%</span>
                    </div>
                  </Field>
                )}

                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="pr-3">
                    <p className="text-sm font-semibold text-gray-800">Collect a card on file</p>
                    <p className="text-xs text-gray-400 mt-0.5">Ask every client to save a card with Stripe at booking (no upfront charge) so you can collect deposits/no-show/late-cancel fees later. Basic+</p>
                  </div>
                  <button type="button" onClick={() => isPaid ? f("collectCardOnFile", !form.collectCardOnFile) : promptUpgrade("BASIC", "Card on file")}
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.collectCardOnFile ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.collectCardOnFile ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={cn("rounded-xl border border-gray-100 bg-gray-50 p-4", !isPro && "opacity-85")}>
                    <Field label="No-show fee">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 shrink-0">$</span>
                        <Input type="number" min={0} step="0.01" disabled={!isPro} onFocus={() => !isPro && promptUpgrade("PRO", "Automatic no-show fees")}
                          value={(((form.noShowFeeCents as number) ?? 0) / 100).toString()}
                          onChange={(e) => f("noShowFeeCents", Math.round(Number(e.target.value) * 100))} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Pro automatic charge. Basic+ can still charge manually from checkout.</p>
                      {!isPro && <button type="button" onClick={() => promptUpgrade("PRO", "Automatic no-show fees")} className="mt-2 text-xs font-semibold text-violet-600 hover:underline">Upgrade to unlock</button>}
                    </Field>
                  </div>
                  <div className={cn("rounded-xl border border-gray-100 bg-gray-50 p-4", !isPro && "opacity-85")}>
                    <Field label="Late-cancellation fee">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 shrink-0">$</span>
                        <Input type="number" min={0} step="0.01" disabled={!isPro} onFocus={() => !isPro && promptUpgrade("PRO", "Automatic late-cancellation fees")}
                          value={(((form.cancellationFeeCents as number) ?? 0) / 100).toString()}
                          onChange={(e) => f("cancellationFeeCents", Math.round(Number(e.target.value) * 100))} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Pro automatic charge when a client cancels inside your window.</p>
                      {!isPro && <button type="button" onClick={() => promptUpgrade("PRO", "Automatic late-cancellation fees")} className="mt-2 text-xs font-semibold text-violet-600 hover:underline">Upgrade to unlock</button>}
                    </Field>
                  </div>
                </div>
                <div className={cn("flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50")}>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Manual charges</p>
                    <p className="text-xs text-gray-400 mt-0.5">Basic+ businesses can charge a client manually from checkout for fees, balances, or add-ons.</p>
                  </div>
                  <button type="button" onClick={() => isPaid ? toast.success("Manual charges are available on your plan") : promptUpgrade("BASIC", "Manual charges")}
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", isPaid ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", isPaid ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>
              </div>
            )}

            {section === "online" && (
              <div className="p-6 space-y-5">
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
                    <button type="button" onClick={copyUrl} className="text-gray-400 hover:text-violet-600 transition-colors shrink-0">
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-violet-500 mt-2">Share this non-email public link on your website, Instagram bio, or Google Business profile.</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-gray-700" />
                    <span className="text-sm font-semibold text-gray-900">Embed on your website</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">Paste this snippet into your site&apos;s HTML to embed the booking widget. It uses your public business ID instead of an email-derived slug.</p>
                  <div className="flex items-start gap-2 bg-gray-900 rounded-xl px-4 py-3">
                    <code className="text-xs text-gray-100 flex-1 break-all font-mono">{embedSnippet}</code>
                    <button type="button" onClick={copyEmbed} className="text-gray-400 hover:text-white transition-colors shrink-0 mt-0.5">
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
                    <Field label="Hero headline">
                      <Input value={(bookingSettings.headline as string) ?? ""} onChange={(e) => bf("headline", e.target.value)} placeholder={`Book with ${biz?.name ?? "us"}`} />
                    </Field>
                    <Field label="Short introduction">
                      <textarea
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-violet-200"
                        value={(bookingSettings.intro as string) ?? ""}
                        onChange={(e) => bf("intro", e.target.value)}
                        placeholder="Tell clients what to expect before they book." />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="SEO title">
                        <Input value={(bookingSettings.seoTitle as string) ?? ""} onChange={(e) => bf("seoTitle", e.target.value)} placeholder={`${biz?.name ?? "Business"} booking`} />
                      </Field>
                      <Field label="Brand accent">
                        <Input value={(bookingSettings.brandColor as string) ?? "#E9A23C"} onChange={(e) => bf("brandColor", e.target.value)} placeholder="#E9A23C" />
                      </Field>
                    </div>
                    <Field label="SEO description">
                      <Input value={(bookingSettings.seoDescription as string) ?? ""} onChange={(e) => bf("seoDescription", e.target.value)} placeholder="Book appointments online." />
                    </Field>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Live preview</p>
                    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: String(bookingSettings.brandColor ?? "#E9A23C") }} />
                      <h4 className="mt-4 text-base font-bold text-gray-900">{String(bookingSettings.headline || `Book with ${biz?.name ?? "us"}`)}</h4>
                      <p className="mt-2 text-xs leading-relaxed text-gray-500">{String(bookingSettings.intro || biz?.cancellationPolicy || "Choose a service, pick a time, and confirm your appointment.")}</p>
                      <div className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700">Services and availability appear below</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === "locations" && (
              <div className="p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Locations</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Manage multiple branches under one account. Staff and appointments are assigned per location.</p>
                </div>
                <hr className="border-gray-100" />

                {plan === "FREE" ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">Multi-location requires Basic or Pro</p>
                    <p className="text-xs text-amber-700 mt-1">Upgrade to manage multiple branches, each with their own staff and calendar, under one Pulse account — without needing separate logins per location.</p>
                    <button type="button" onClick={() => { setSection("billing"); }} className="mt-2 text-xs font-semibold text-amber-800 underline">View plans →</button>
                  </div>
                ) : (
                  <>
                    {plan === "BASIC" && (
                      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                        <p className="text-xs text-blue-700">Basic supports 1 extra location. Upgrade to Pro for unlimited locations.</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      {locations.length === 0 && <p className="text-xs text-gray-400">No extra locations yet.</p>}
                      {locations.map((loc) => (
                        <div key={loc.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3">
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
                              onClick={async () => { if (!confirm(`Remove "${loc.name}"?`)) return; try { await api.locations.remove(bizId, loc.id); loadLocations(); toast.success("Location removed"); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } }}
                              className="text-xs text-red-600 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50">
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                      <p className="text-sm font-medium text-gray-700">Add location</p>
                      <Input placeholder="Location name (e.g. Downtown)" value={locationForm.name} onChange={(e) => setLocationForm((p) => ({ ...p, name: e.target.value }))} />
                      <Input placeholder="Address (optional)" value={locationForm.address} onChange={(e) => setLocationForm((p) => ({ ...p, address: e.target.value }))} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="+1 (416) 555-0123" type="tel" value={locationForm.phone} onChange={(e) => setLocationForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))} />
                        <select value={locationForm.timezone} onChange={(e) => setLocationForm((p) => ({ ...p, timezone: e.target.value }))}
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
              <div className="p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Payouts</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Connect your bank account and withdraw your earnings. Powered by Stripe Connect.</p>
                </div>
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
                        { id: "FREE",  name: "Free",    mo: "$0",    cp: "2.6% + $0.15", cnp: "3.5% + $0.15", online: "3.3% + $0.30" },
                        { id: "BASIC", name: "Plus",    mo: "$49",   cp: "2.5% + $0.15", cnp: "3.5% + $0.15", online: "2.9% + $0.30" },
                        { id: "PRO",   name: "Premium", mo: "$149",  cp: "2.4% + $0.15", cnp: "3.5% + $0.15", online: "2.9% + $0.00" },
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
                {!connectStatus ? (
                  <p className="text-sm text-gray-400">Loading…</p>
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
                      <div className="grid grid-cols-2 gap-3">
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
                          value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)}
                          className="flex-1"
                        />
                        <Button type="button" loading={connectBusy === "payout"}
                          onClick={async () => {
                            const cents = Math.round(parseFloat(payoutAmount) * 100);
                            if (!cents || cents < 100) { toast.error("Minimum payout is $1.00"); return; }
                            setConnectBusy("payout");
                            try {
                              await api.connect.payout(cents, false, biz?.currency?.toLowerCase());
                              toast.success("Payout initiated — funds will arrive in 1–2 business days");
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
                        try { const { url } = await api.connect.dashboard(); window.open(url, "_blank"); }
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
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Choose what emails and SMS messages are sent to clients.</p>
                </div>
                <hr className="border-gray-100" />

                {/* Plan capability summary */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {(["FREE", "BASIC", "PRO"] as const).map((p) => (
                    <div key={p} className={cn("rounded-xl border p-3", plan === p ? "border-violet-300 bg-violet-50" : "border-gray-100 bg-gray-50")}>
                      <p className={cn("font-semibold mb-1", plan === p ? "text-violet-700" : "text-gray-500")}>{p}{plan === p && " ✓"}</p>
                      <p className="text-gray-500 leading-relaxed">
                        {p === "FREE" && "Confirmation\nCancellation\nReschedule"}
                        {p === "BASIC" && "24h email reminder\nPost-visit follow-up\n+ all Free"}
                        {p === "PRO" && "72h email reminder\nSMS confirmation\n2h SMS reminder\n+ all Basic"}
                      </p>
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
                  const allowed = tier === "FREE" || (tier === "BASIC" && isPaid) || (tier === "PRO" && plan === "PRO");
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

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">SMS notifications (Pro plan only)</p>
                {([
                  { key: "smsConfirmation" as const, label: "Booking confirmation SMS", desc: "Text sent immediately when a booking is confirmed" },
                  { key: "smsReminder2h"   as const, label: "2-hour SMS reminder",      desc: "Sent 2 hours before the appointment via Twilio" },
                ] as const).map(({ key, label, desc }) => {
                  const enabled = notificationSettings[key] !== false;
                  return (
                    <div key={key} className="flex items-start justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      {plan === "PRO" ? (
                        <div className="inline-flex shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-1">
                          {([{ label: "On", value: true }, { label: "Off", value: false }] as const).map((opt) => (
                            <button key={opt.label} type="button" onClick={() => nf(key, opt.value)}
                              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                                enabled === opt.value ? "bg-violet-600 text-white" : "text-gray-500 hover:bg-gray-50")}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <button type="button" onClick={() => setSection("billing")}
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
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Security</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Protect your account with a second step at sign-in.</p>
                </div>
                <hr className="border-gray-100" />

                <div className="flex items-start justify-between gap-4 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Two-factor sign-in</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      After your password, we&apos;ll ask for a one-time code before letting you in.
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
                    <div className="grid grid-cols-2 gap-1.5 font-mono text-sm text-gray-800 bg-white rounded-lg border border-amber-100 p-3">
                      {recoveryCodes.map((c) => <span key={c}>{c}</span>)}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button type="button"
                        onClick={() => { navigator.clipboard?.writeText(recoveryCodes.join("\n")); toast.success("Recovery codes copied"); }}
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
                <div className="flex items-start justify-between gap-4 py-1">
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
              <div className="p-6 space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Billing &amp; plan</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Choose the plan that fits your business.</p>
                </div>
                <hr className="border-gray-100" />

                {/* Referral: apply a code for a discount + share your own */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Have a referral code?</p>
                    <p className="text-xs text-amber-700 mt-0.5">Enter it before upgrading to get a discount on your subscription.</p>
                    <input
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                      placeholder="PULSE-XXXXXX"
                      className="mt-2 w-full sm:w-64 text-sm border border-amber-300 rounded-lg px-3 py-2 bg-white uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  {myReferral && (
                    <div className="border-t border-amber-200 pt-3">
                      <p className="text-xs text-amber-700">Your referral code — share it so friends get a discount{myReferral.referredCount > 0 ? ` (${myReferral.referredCount} referred so far)` : ""}:</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <code className="text-sm font-bold text-amber-900 bg-white border border-amber-300 rounded-lg px-3 py-1.5">{myReferral.code}</code>
                        <button type="button"
                          onClick={() => { navigator.clipboard.writeText(myReferral.code); setRefCopied(true); setTimeout(() => setRefCopied(false), 1500); }}
                          className="text-xs font-semibold text-amber-700 border border-amber-300 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 transition-colors">
                          {refCopied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-4">
                  {[
                    {
                      id: "FREE", name: "Free", price: "$0", period: "/mo",
                      desc: "Get started with the essentials",
                      features: ["Unlimited bookings","Client management","Email confirmations","Public booking page","Basic dashboard"],
                      cta: "Current plan", disabled: true,
                    },
                    {
                      id: "BASIC", name: "Basic", price: "$10", period: "/mo",
                      desc: "Great for growing salons",
                      recommended: true,
                      features: ["Everything in Free","Email reminders (24h)","Deposit collection","Manual charges","Cancellation policies"],
                      cta: "Upgrade to Basic", disabled: false,
                    },
                    {
                      id: "PRO", name: "Pro", price: "$20", period: "/mo",
                      desc: "Full power for busy businesses",
                      highlight: true,
                      features: ["Everything in Basic","SMS reminders (2h)","Automatic no-show fees","Late-cancellation fees","Priority support","Analytics"],
                      cta: "Upgrade to Pro", disabled: false,
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
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                            <span className="text-sm text-gray-400">{plan.period}</span>
                          </div>
                          <p className="font-semibold text-gray-800 mt-0.5">{plan.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{plan.desc}</p>
                        </div>
                        {(() => {
                          const isCurrent = (biz?.plan ?? "FREE") === plan.id;
                          const canBuy = (plan.id === "BASIC" || plan.id === "PRO") && !isCurrent;
                          return (
                            <button
                              type="button"
                              disabled={isCurrent || billingBusy !== null}
                              onClick={() => { if (canBuy) upgrade(plan.id as "BASIC" | "PRO"); }}
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
                              {isCurrent ? "Current plan" : billingBusy === plan.id ? "Redirecting…" : plan.cta}
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
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Stripe billing portal</p>
                      <p className="text-xs text-gray-400 mt-0.5">Update your card, view invoices, switch billing details, or cancel your plan.</p>
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

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              {section !== "billing" && section !== "security" && section !== "payouts" && section !== "locations" && section !== "calendar" && <Button type="submit" loading={saving} size="md">Save changes</Button>}
            </div>
          </form>
        </div>

      </div>

    </div>
  );
}
