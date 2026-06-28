"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { api, type Business } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/LoadingSpinner";

type NotifSettings = NonNullable<Business["notificationSettings"]>;

const EMAIL_TOGGLES = [
  { key: "emailConfirmation",      label: "Booking confirmation",    desc: "Sent immediately when a new appointment is booked",                        tier: "FREE" },
  { key: "emailReminder72h",       label: "72-hour reminder",         desc: "Sent 3 days before the appointment (Pro only)",                            tier: "PRO" },
  { key: "emailReminder24h",       label: "24-hour reminder",         desc: "Sent the day before the appointment",                                      tier: "BASIC" },
  { key: "emailFollowUp",          label: "Post-visit follow-up",     desc: "Thank-you email sent 24h after the appointment to encourage rebooking",    tier: "BASIC" },
  { key: "emailCancellation",      label: "Cancellation notice",      desc: "Sent when a booking is cancelled by client or business",                   tier: "FREE" },
  { key: "emailReschedule",        label: "Reschedule notice",        desc: "Sent when an appointment is moved to a new time",                          tier: "FREE" },
  { key: "emailStaffCancellation", label: "Staff cancellation email", desc: "Special email when the business cancels on the client",                    tier: "FREE" },
] as const;

const SMS_TOGGLES = [
  { key: "smsConfirmation", label: "Booking confirmation SMS", desc: "Text sent immediately when a booking is confirmed" },
  { key: "smsReminder2h",   label: "2-hour SMS reminder",      desc: "Sent 2 hours before the appointment via Twilio" },
] as const;

const PLAN_TIERS = [
  { id: "FREE",      label: "Free",      lines: ["In-app messaging only", "Confirmation email", "Cancellation & reschedule"] },
  { id: "BASIC",     label: "Basic",     lines: ["Receive SMS from clients", "Reply when texted first", "24h email reminder", "+ all Free"] },
  { id: "PRO",       label: "Pro",       lines: ["Initiate SMS first", "SMS confirmation", "2h SMS reminder", "72h email reminder", "+ all Basic"] },
  { id: "UNLIMITED", label: "Unlimited", lines: ["All Pro features", "Across all locations", "Multi-location inbox"] },
] as const;

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-1">
      {([{ label: "On", value: true }, { label: "Off", value: false }] as const).map((opt) => (
        <button key={opt.label} type="button" onClick={() => onChange(opt.value)}
          aria-pressed={enabled === opt.value}
          className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            enabled === opt.value ? "bg-violet-600 text-white" : "text-gray-500 hover:bg-gray-50")}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function UpgradeButton({ label }: { label: string }) {
  return (
    <Link href="/dashboard/settings?tab=billing"
      className="self-start text-xs font-semibold text-violet-600 border border-violet-300 rounded-lg px-3 py-1.5 hover:bg-violet-50 transition-colors shrink-0">
      {label}
    </Link>
  );
}

export default function RemindersPage() {
  const { user } = useCurrentUser();
  const bizId = user?.businessId ?? "";
  const [biz, setBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    if (!bizId) { setLoading(false); return; }
    setLoadError(""); setLoading(true);
    try { setBiz(await api.business.get(bizId)); }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const plan = biz?.plan ?? "FREE";
  const isPaid = biz?.capabilities?.deposits ?? (plan === "BASIC" || plan === "PRO" || plan === "UNLIMITED");
  const isPro  = biz?.capabilities?.sms      ?? (plan === "PRO" || plan === "UNLIMITED");
  const settings = (biz?.notificationSettings ?? {}) as NotifSettings;

  // Save a single toggle immediately (optimistic), so this page has no "unsaved
  // changes" friction — unlike the old Settings tab it lived in.
  async function nf(key: keyof NotifSettings, value: boolean) {
    const next = { ...settings, [key]: value };
    setBiz((p) => (p ? { ...p, notificationSettings: next } : p));
    try {
      await api.business.update(bizId, { notificationSettings: next });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      load(); // revert to server truth
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-violet-600" />
          <h1 className="text-xl font-bold text-gray-900">Reminders &amp; notifications</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">Choose what emails and SMS messages are sent to your clients.</p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      ) : (
        <div className="space-y-4">
          {/* Plan capability summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            {PLAN_TIERS.map((p) => (
              <div key={p.id} className={cn("rounded-xl border p-3", plan === p.id ? "border-violet-300 bg-violet-50" : "border-gray-100 bg-gray-50")}>
                <p className={cn("font-semibold mb-1.5", plan === p.id ? "text-violet-700" : "text-gray-500")}>{p.label}{plan === p.id && " ✓"}</p>
                <p className="text-gray-500 leading-relaxed whitespace-pre-line text-left">{p.lines.join("\n")}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email notifications</p>
            {EMAIL_TOGGLES.map(({ key, label, desc, tier }) => {
              const allowed = tier === "FREE" || (tier === "BASIC" && isPaid) || (tier === "PRO" && isPro);
              const enabled = settings[key] !== false;
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
                  {allowed ? <Toggle enabled={enabled} onChange={(v) => nf(key, v)} /> : <UpgradeButton label={tier === "PRO" ? "Upgrade to Pro" : "Basic+"} />}
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SMS notifications (Pro+)</p>
            {SMS_TOGGLES.map(({ key, label, desc }) => {
              const enabled = settings[key] !== false;
              return (
                <div key={key} className="flex flex-col gap-3 py-3 border-b border-gray-50 last:border-0 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </div>
                  {isPro ? <Toggle enabled={enabled} onChange={(v) => nf(key, v)} /> : <UpgradeButton label="Upgrade to Pro" />}
                </div>
              );
            })}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-800 mb-1">Email provider: Resend · SMS provider: Twilio</p>
            <p className="text-xs text-blue-600">Confirmations, cancellations, and reschedules are always sent on every plan. Reminders, follow-ups, and SMS messages follow the plan gating shown above. All appointment emails include a calendar (.ics) attachment as a backup.</p>
          </div>
        </div>
      )}
    </div>
  );
}
