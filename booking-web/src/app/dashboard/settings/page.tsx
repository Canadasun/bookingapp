"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Globe, Clock, DollarSign, Building2, ChevronRight, CreditCard, Zap, CheckCircle2, Bell } from "lucide-react";
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

type Section = "profile" | "booking" | "payments" | "online" | "notifications" | "billing";

const SECTIONS: { id: Section; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "profile",       label: "Business profile",   icon: Building2,   desc: "Name, contact info, timezone" },
  { id: "booking",       label: "Booking policies",   icon: Clock,       desc: "Notice, cancellations, advance limits" },
  { id: "payments",      label: "Payments & fees",    icon: DollarSign,  desc: "Deposits, no-show fees" },
  { id: "online",        label: "Online booking",     icon: Globe,       desc: "Booking page link, availability" },
  { id: "notifications", label: "Notifications",      icon: Bell,        desc: "Emails & SMS sent to clients" },
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
  const [section, setSection] = useState<Section>("profile");
  const [form, setForm]       = useState<Partial<Business>>({});

  const user = getUser();
  const bizId = user?.businessId ?? "";

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
                  <p className="text-xs text-gray-400 mt-1">Clients warned when cancelling within this window.</p>
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
                  <p className="text-xs text-gray-400 mt-0.5">Configure deposit collection and no-show protection.</p>
                </div>
                <hr className="border-gray-100" />
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
                <Field label="No-show fee (cents, 0 = disabled)">
                  <Input type="number" min={0} value={(form.noShowFeeCents as number) ?? 0}
                    onChange={(e) => f("noShowFeeCents", Number(e.target.value))} />
                  <p className="text-xs text-gray-400 mt-1">Charge clients who miss their appointment.</p>
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
              {section !== "billing" && section !== "notifications" && <Button type="submit" loading={saving} size="md">Save changes</Button>}
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
