"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Globe, Clock, DollarSign, Building2, ChevronRight, CreditCard, Zap, CheckCircle2, Bell, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, Business } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";

const TIMEZONES = [
  "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "America/Anchorage","Pacific/Honolulu","America/Toronto","America/Vancouver",
  "Europe/London","Europe/Paris","Europe/Berlin","Asia/Dubai","Asia/Kolkata",
  "Asia/Singapore","Asia/Tokyo","Australia/Sydney","Pacific/Auckland",
];

type Section = "profile" | "booking" | "payments" | "online" | "notifications" | "security" | "billing";

const SECTIONS: { id: Section; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "profile",       label: "Business profile",   icon: Building2,   desc: "Name, contact info, timezone" },
  { id: "booking",       label: "Booking policies",   icon: Clock,       desc: "Notice, cancellations, advance limits" },
  { id: "payments",      label: "Payments & fees",    icon: DollarSign,  desc: "Deposits, no-show fees" },
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

export default function SettingsPage() {
  const [biz, setBiz]       = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [copied, setCopied]   = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [section, setSection] = useState<Section>("profile");
  const [form, setForm]       = useState<Partial<Business>>({});

  const user = getUser();
  const bizId = user?.businessId ?? "";

  // Two-factor: seeded from the session, updated optimistically on toggle.
  const [twoFA, setTwoFA] = useState<boolean>(user?.twoFactorEnabled ?? false);
  const [twoFAMethod, setTwoFAMethod] = useState<"EMAIL" | "SMS">(user?.twoFactorMethod ?? "EMAIL");
  const [twoFASaving, setTwoFASaving] = useState(false);

  async function saveTwoFactor(enabled: boolean, method: "EMAIL" | "SMS") {
    setTwoFASaving(true);
    const prev = { enabled: twoFA, method: twoFAMethod };
    setTwoFA(enabled); setTwoFAMethod(method);
    try {
      await api.auth.setTwoFactor(enabled, method);
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!bizId) return;
    setSaving(true);
    try { await api.business.update(bizId, form); toast.success("Settings saved"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  function copyUrl() {
    const url = `${window.location.origin}/book`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <LoadingSpinner />;

  const bookingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/book/${biz?.slug ?? ""}`;
  const embedOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const embedSnippet = `<script src="${embedOrigin}/embed.js" data-slug="${biz?.slug ?? ""}" async></script>`;
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

      <div className="flex gap-5">

        {/* Left nav */}
        <aside className="w-56 shrink-0">
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
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <form onSubmit={save}>

            {section === "profile" && (
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Business profile</h3>
                  <p className="text-xs text-gray-400 mt-0.5">This information appears on your booking page.</p>
                </div>
                <hr className="border-gray-100" />
                <Field label="Business name">
                  <Input value={(form.name as string) ?? ""} onChange={(e) => f("name", e.target.value)} placeholder="Demo Salon" />
                </Field>
                <Field label="Contact email">
                  <Input type="email" value={(form.email as string) ?? ""} onChange={(e) => f("email", e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Phone">
                    <Input type="tel" value={(form.phone as string) ?? ""} onChange={(e) => f("phone", e.target.value)} />
                  </Field>
                  <Field label="Timezone">
                    <select value={(form.timezone as string) ?? "America/New_York"} onChange={(e) => f("timezone", e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Address">
                  <Input value={(form.address as string) ?? ""} onChange={(e) => f("address", e.target.value)} placeholder="123 Main St, City, State" />
                </Field>
              </div>
            )}

            {section === "booking" && (
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Booking policies</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Control when and how clients can book and cancel.</p>
                </div>
                <hr className="border-gray-100" />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Min. notice (minutes)">
                    <Input type="number" min={0} value={(form.minNoticeMinutes as number) ?? 120}
                      onChange={(e) => f("minNoticeMinutes", Number(e.target.value))} />
                  </Field>
                  <Field label="Max advance booking (days)">
                    <Input type="number" min={1} value={(form.maxAdvanceDays as number) ?? 60}
                      onChange={(e) => f("maxAdvanceDays", Number(e.target.value))} />
                  </Field>
                </div>
                <Field label="Cancellation window (hours)">
                  <Input type="number" min={0} value={(form.cancellationWindowHours as number) ?? 24}
                    onChange={(e) => f("cancellationWindowHours", Number(e.target.value))} />
                  <p className="text-xs text-gray-400 mt-1">Cancel before this window = free. Inside it = the cancellation fee applies (paid plans).</p>
                </Field>
                <Field label="Cancellation policy (clients agree to this before booking)">
                  <textarea
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm min-h-[90px] focus:outline-none focus:ring-2 focus:ring-violet-200"
                    value={(form.cancellationPolicy as string) ?? ""}
                    onChange={(e) => f("cancellationPolicy", e.target.value)}
                    placeholder="Appointments cancelled within 24 hours of the scheduled time may be subject to a cancellation fee…" />
                  <p className="text-xs text-gray-400 mt-1">Shown on your booking page — clients must accept it before they can book.</p>
                </Field>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Allow client reschedule</p>
                    <p className="text-xs text-gray-400">Clients can reschedule from the manage page</p>
                  </div>
                  <button type="button" onClick={() => f("allowClientReschedule", !form.allowClientReschedule)}
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.allowClientReschedule ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.allowClientReschedule ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>
              </div>
            )}

            {section === "payments" && (
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Payments &amp; fees</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Configure deposit collection and no-show / cancellation protection.</p>
                </div>
                <hr className="border-gray-100" />
                {(biz?.plan ?? "FREE") === "FREE" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    🔒 Deposits, no-show & cancellation fees are a <span className="font-semibold">paid-plan</span> feature. On the Free plan no money is collected at booking and clients can cancel at any time for free.{" "}
                    <button type="button" className="underline font-semibold" onClick={() => setSection("billing")}>Upgrade</button>
                  </div>
                )}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Require deposit at booking</p>
                    <p className="text-xs text-gray-400">Collect a partial payment when clients book</p>
                  </div>
                  <button type="button" onClick={() => f("requireDeposit", !form.requireDeposit)}
                    className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", form.requireDeposit ? "bg-violet-600" : "bg-gray-200")}>
                    <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", form.requireDeposit ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>
                {form.requireDeposit && (
                  <Field label="Deposit percentage">
                    <div className="flex items-center gap-2">
                      <Input type="number" min={1} max={100} value={(form.depositPercent as number) ?? 25}
                        onChange={(e) => f("depositPercent", Number(e.target.value))} />
                      <span className="text-sm text-gray-500 shrink-0">%</span>
                    </div>
                  </Field>
                )}
                <Field label="No-show fee ($, 0 = disabled)">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 shrink-0">$</span>
                    <Input type="number" min={0} step="0.01"
                      value={(((form.noShowFeeCents as number) ?? 0) / 100).toString()}
                      onChange={(e) => f("noShowFeeCents", Math.round(Number(e.target.value) * 100))} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Charged to the card on file when you mark a confirmed appointment as a no-show.</p>
                </Field>
                <Field label="Late-cancellation fee ($, 0 = disabled)">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 shrink-0">$</span>
                    <Input type="number" min={0} step="0.01"
                      value={(((form.cancellationFeeCents as number) ?? 0) / 100).toString()}
                      onChange={(e) => f("cancellationFeeCents", Math.round(Number(e.target.value) * 100))} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Charged to the card on file when a client cancels <em>inside</em> the cancellation window (paid plans only). Free if they cancel earlier.</p>
                </Field>
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
                    <span className="text-sm font-semibold text-violet-700">Your booking page</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-violet-200 rounded-xl px-4 py-3">
                    <code className="text-sm text-violet-600 flex-1 truncate">{bookingUrl}</code>
                    <button type="button" onClick={copyUrl} className="text-gray-400 hover:text-violet-600 transition-colors shrink-0">
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-violet-500 mt-2">Share this link on your website, Instagram bio, or Google Business profile.</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-gray-700" />
                    <span className="text-sm font-semibold text-gray-900">Embed on your website</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">Paste this snippet into your site&apos;s HTML to embed the booking widget. It resizes automatically.</p>
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
                    <span className="text-gray-600">Business slug</span>
                    <code className="text-gray-800 font-medium">{biz?.slug}</code>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Timezone</span>
                    <span className="text-gray-800 font-medium">{biz?.timezone}</span>
                  </div>
                </div>
              </div>
            )}

            {section === "notifications" && (
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Choose what emails and SMS messages are sent to clients.</p>
                </div>
                <hr className="border-gray-100" />

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email notifications (all plans)</p>
                {[
                  { label: "Booking confirmation", desc: "Sent immediately when a new appointment is booked" },
                  { label: "24-hour reminder", desc: "Sent the day before the appointment (Basic & Pro)" },
                  { label: "Cancellation notice", desc: "Sent when a booking is cancelled by client or business" },
                  { label: "Reschedule notice", desc: "Sent when an appointment is moved to a new time" },
                  { label: "Staff cancellation", desc: "Special email when business cancels on the client" },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-start justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium text-emerald-700">Active</span>
                    </div>
                  </div>
                ))}

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">SMS notifications (Pro plan only)</p>
                <div className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">2-hour SMS reminder</p>
                    <p className="text-xs text-gray-400 mt-0.5">Sent 2 hours before the appointment via Twilio</p>
                  </div>
                  {biz?.plan === "PRO" ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium text-emerald-700">Active</span>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setSection("billing")}
                      className="text-xs font-semibold text-violet-600 border border-violet-300 rounded-lg px-3 py-1 hover:bg-violet-50 transition-colors shrink-0">
                      Upgrade to Pro
                    </button>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-800 mb-1">Email provider: Resend</p>
                  <p className="text-xs text-blue-600">Emails are sent via Resend from your configured RESEND_FROM_EMAIL address. SMS uses Twilio (Pro plan). Both are configured in your server environment.</p>
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
                      features: ["Everything in Free","Email reminders (24h)","Offers & promotions","Client portal","Cancellation policies"],
                      cta: "Upgrade to Basic", disabled: false,
                    },
                    {
                      id: "PRO", name: "Pro", price: "$20", period: "/mo",
                      desc: "Full power for busy businesses",
                      highlight: true,
                      features: ["Everything in Basic","SMS reminders (2h)","Deposit collection","No-show fee charging","Priority support","Analytics"],
                      cta: "Upgrade to Pro", disabled: false,
                    },
                  ].map((plan) => (
                    <div key={plan.id} className={cn(
                      "rounded-2xl border-2 p-5 relative",
                      plan.highlight ? "border-violet-500 bg-violet-50" : "border-gray-100 bg-white",
                    )}>
                      {plan.highlight && (
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
                        <button
                          type="button"
                          disabled={plan.disabled}
                          onClick={() => toast.info("Stripe billing coming soon — contact us to upgrade.")}
                          className={cn(
                            "text-xs font-semibold px-4 py-2 rounded-xl transition-colors shrink-0",
                            plan.disabled
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : plan.highlight
                              ? "bg-violet-600 text-white hover:bg-violet-700"
                              : "border border-violet-300 text-violet-600 hover:bg-violet-50",
                          )}>
                          {plan.cta}
                        </button>
                      </div>
                      <ul className="mt-4 space-y-1.5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                            <CheckCircle2 className={cn("w-3.5 h-3.5 shrink-0", plan.highlight ? "text-violet-500" : "text-emerald-500")} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

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
              {section !== "billing" && section !== "notifications" && section !== "security" && <Button type="submit" loading={saving} size="md">Save changes</Button>}
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
