import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Calendar, Clock, Bell, CreditCard, CheckCircle2, ArrowRight, Zap } from "lucide-react";
import {
  LandingAuthCta,
  LandingHeroCta,
  LandingBottomCta,
  LandingFooterLinks,
  LandingResources,
  LandingSolutions,
} from "@/components/LandingClient";

async function sessionInfo(): Promise<{ role?: string; authed: boolean }> {
  const jar = await cookies();
  const authed = !!(jar.get("booking_token")?.value || jar.get("booking_refresh")?.value || jar.get("booking_user")?.value);
  const raw = jar.get("booking_user")?.value;
  let role: string | undefined;
  if (raw) {
    for (const v of [raw, decodeURIComponent(raw)]) {
      try { role = JSON.parse(Buffer.from(v, "base64").toString("utf8"))?.role; break; } catch { /* try next */ }
    }
  }
  return { role, authed };
}

const steps = [
  { num: "01", title: "Add your services", desc: "Set up your services, pricing, and availability in under 5 minutes." },
  { num: "02", title: "Share your link", desc: "Put your booking link in your Instagram bio, Google profile, or website." },
  { num: "03", title: "Get booked", desc: "Clients book themselves around the clock. You just show up and do the work." },
];

const features = [
  {
    icon: Clock,
    title: "24/7 Online Booking",
    desc: "No more phone tag. Clients book, reschedule, and cancel on their own time.",
  },
  {
    icon: Bell,
    title: "Automated Reminders",
    desc: "Email and SMS reminders go out automatically. No-shows drop by up to 80%.",
  },
  {
    icon: CreditCard,
    title: "Deposits & Protection",
    desc: "Collect a deposit at booking. Your time is protected even when plans change.",
  },
];

export default async function LandingPage() {
  const { role, authed } = await sessionInfo();
  if (role === "ADMIN") redirect("/admin");
  if (role === "CLIENT") redirect("/my/dashboard");
  if ((role && role !== "CLIENT") || (authed && !role)) redirect("/dashboard");

  return (
    <div className="flex flex-col min-h-screen brand-shell">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shadow-md shadow-violet-200">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-ink tracking-tight">Pulse</span>
          </div>
          <LandingAuthCta />
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 pt-20 pb-8 text-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/90 border border-[#E9DDCB] text-sm font-semibold text-ink px-4 py-1.5 rounded-full mb-8 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-violet-600" />
            Trusted by 10,000+ professionals
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-extrabold text-ink tracking-tight leading-[1.08] mb-6">
            The simplest way<br />
            to take{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">
              bookings
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Clients book themselves 24/7. You get reminders, deposits, and a beautiful dashboard — without lifting a finger.
          </p>

          <LandingHeroCta />
        </div>

        {/* Mock UI card */}
        <div className="max-w-sm mx-auto px-6 pb-24">
          <div className="brand-panel rounded-[2rem] p-4">
            <div className="bg-[#19212B] rounded-[1.5rem] p-5 text-white">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[11px] text-white/45 uppercase tracking-widest mb-0.5">Today&apos;s schedule</p>
                  <p className="text-xl font-bold">3 bookings</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
              </div>

              {/* Appointment cards */}
              <div className="space-y-2.5">
                {[
                  { time: "10:00", name: "Amara Lee", service: "Lash lift & tint", color: "bg-violet-400" },
                  { time: "1:30",  name: "Jordan Kim", service: "Brow lamination", color: "bg-amber-400" },
                  { time: "3:15",  name: "Maya Chen",  service: "Facial + gua sha", color: "bg-teal-400" },
                ].map(({ time, name, service, color }) => (
                  <div key={name} className="flex items-center gap-3 bg-white/[0.07] rounded-2xl px-4 py-3">
                    <p className="text-xs font-bold text-white/50 w-10 shrink-0">{time}</p>
                    <div className={`w-1 h-8 rounded-full ${color} shrink-0`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{name}</p>
                      <p className="text-xs text-white/45 truncate">{service}</p>
                    </div>
                    <span className="ml-auto rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white/70 shrink-0">
                      Confirmed
                    </span>
                  </div>
                ))}
              </div>

              {/* New booking pill */}
              <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3 text-sm font-semibold">
                <Calendar className="w-4 h-4" /> New booking just arrived
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Logged-in owner shortcuts ── */}
      <LandingResources />
      <LandingSolutions />

      {/* ── How it works ── */}
      <section className="py-24 bg-white/60 border-y border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-ink mb-3">Up and running in minutes</h2>
            <p className="text-slate-500 max-w-md mx-auto">No training required. No complicated setup. Just your services, your link, and your clients.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map(({ num, title, desc }) => (
              <div key={num} className="relative bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm">
                <p className="text-4xl font-black text-violet-100 mb-4 leading-none">{num}</p>
                <h3 className="text-base font-bold text-ink mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-ink mb-3">Everything your schedule needs</h2>
            <p className="text-slate-500 max-w-md mx-auto">Built for small businesses, solo professionals, and growing teams — from pet groomers to beauty, wellness, and every appointment-based service in between.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 hover:shadow-lg hover:shadow-amber-100 transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-violet-700" />
                </div>
                <h3 className="text-base font-bold text-ink mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Band ── */}
      <section className="py-20 bg-[#19212B]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center mx-auto mb-6">
            <ArrowRight className="w-5 h-5 text-white" />
          </div>
          <LandingBottomCta />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 border-t border-[#E9DDCB] bg-white/80">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">© {new Date().getFullYear()} Pulse Appointments</span>
          </div>
          <LandingFooterLinks />
        </div>
      </footer>
    </div>
  );
}
