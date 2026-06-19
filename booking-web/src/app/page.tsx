import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import { verifyCookieValue } from "@/lib/cookie-sign";
import { Clock, Bell, CreditCard, CheckCircle2, ArrowRight, Zap, Star } from "lucide-react";
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
    for (const encoded of [raw, decodeURIComponent(raw)]) {
      const verified = verifyCookieValue(encoded);
      if (!verified) continue;
      try { role = JSON.parse(Buffer.from(verified, "base64").toString("utf8"))?.role; break; } catch { /* try next */ }
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
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    icon: Bell,
    title: "Automated Reminders",
    desc: "Paid plans add scheduled email and SMS reminders. Every plan includes booking confirmations and updates.",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-700",
  },
  {
    icon: CreditCard,
    title: "Deposits & Protection",
    desc: "Basic and higher plans can collect deposits at booking; Pro adds automatic saved-card fee protection.",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
];

const testimonials = [
  { quote: "I set it up in 20 minutes and had my first online booking the same evening. Total game-changer.", name: "Amara O.", role: "Esthetician" },
  { quote: "The deposit feature alone saved me from countless no-shows. Worth every penny.", name: "Jordan P.", role: "Hair Stylist" },
  { quote: "My clients love booking from their phone at midnight. I wake up to confirmed appointments.", name: "Maya K.", role: "Massage Therapist" },
];

export default async function LandingPage() {
  const { role, authed } = await sessionInfo();
  if (role === "ADMIN") redirect("/admin");
  if (role === "CLIENT") redirect("/my/dashboard");
  if ((role && role !== "CLIENT") || (authed && !role)) redirect("/dashboard");

  const jsonLdOrg = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Pulse Appointments",
    url: "https://www.pulseappointments.com",
    logo: "https://www.pulseappointments.com/logo-icon.png",
    contactPoint: { "@type": "ContactPoint", email: "support@pulseappointments.com", contactType: "customer support" },
  };
  const jsonLdSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: "https://www.pulseappointments.com",
    name: "Pulse Appointments",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSite) }} />
    <div className="flex flex-col min-h-screen brand-shell">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-ink tracking-tight">Pulse Booking</span>
          </div>
          <LandingAuthCta />
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Animated gradient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="animate-blob absolute -top-32 -left-28 w-[540px] h-[540px] rounded-full bg-amber-300/30 blur-3xl" />
          <div className="animate-blob-alt absolute -top-10 right-[-10rem] w-[440px] h-[440px] rounded-full bg-teal-400/20 blur-3xl" />
          <div className="animate-blob absolute bottom-8 left-1/2 -translate-x-1/2 w-[380px] h-[380px] rounded-full bg-orange-300/15 blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-8 text-center">
          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 bg-white/90 border border-[#E9DDCB] text-sm font-semibold text-ink px-4 py-1.5 rounded-full mb-8 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-violet-600" />
            Built for independent professionals
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up-d1 text-5xl sm:text-6xl font-extrabold text-ink tracking-tight leading-[1.08] mb-6">
            The simplest way<br />
            to take{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600">
              bookings
            </span>
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-up-d2 text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Start free with unlimited online bookings, client management, confirmations, and a public booking page. Upgrade when you need reminders, deposits, or SMS.
          </p>

          <div className="animate-fade-up-d3">
            <LandingHeroCta />
          </div>
        </div>

        {/* Mock UI card */}
        <div className="relative max-w-sm mx-auto px-6 pb-24">
          <div className="brand-panel rounded-[2rem] p-4 shadow-2xl shadow-amber-100">
            <div className="bg-[#19212B] rounded-[1.5rem] p-5 text-white">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[11px] text-white/45 uppercase tracking-widest mb-0.5">Today&apos;s schedule</p>
                  <p className="text-xl font-bold">3 bookings</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Zap className="w-4 h-4" />
                </div>
              </div>

              {/* Appointment cards */}
              <div className="space-y-2.5">
                {[
                  { time: "10:00", name: "Amara Lee",   service: "Lash lift & tint",  color: "bg-violet-400" },
                  { time: "1:30",  name: "Jordan Kim",  service: "Brow lamination",   color: "bg-amber-400" },
                  { time: "3:15",  name: "Maya Chen",   service: "Facial + gua sha",  color: "bg-teal-400" },
                ].map(({ time, name, service, color }) => (
                  <div key={name} className="flex items-center gap-3 bg-white/[0.07] rounded-2xl px-4 py-3 hover:bg-white/[0.10] transition-colors">
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
              <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold shadow-lg shadow-amber-500/25">
                <Bell className="w-4 h-4" /> New booking just arrived
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <div className="py-4 border-y border-[#E9DDCB]/70 bg-white/60 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          {["No credit card required", "Free forever plan", "Cancel anytime"].map((t) => (
            <div key={t} className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>

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
              <div key={num} className="relative bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm overflow-hidden group hover:shadow-md hover:shadow-amber-50 hover:-translate-y-0.5 transition-all duration-200">
                {/* Corner accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-50 to-transparent rounded-bl-3xl" />
                {/* Visible gradient number */}
                <p className="text-7xl font-black mb-4 leading-none bg-gradient-to-br from-amber-400 to-orange-400 bg-clip-text text-transparent select-none">{num}</p>
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
            {features.map(({ icon: Icon, title, desc, iconBg, iconColor }) => (
              <div key={title} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 hover:shadow-xl hover:shadow-amber-50/80 hover:-translate-y-1 transition-all duration-200 group">
                <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <h3 className="text-base font-bold text-ink mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 bg-gradient-to-b from-[#FFFAF2] to-white border-t border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-ink mb-3">Loved by independent pros</h2>
            <p className="text-slate-500 max-w-md mx-auto">From solo estheticians to growing salons — here&apos;s what they say.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map(({ quote, name, role }) => (
              <div key={name} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm hover:shadow-lg hover:shadow-amber-50 hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed mb-5">&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{name}</p>
                    <p className="text-xs text-slate-400">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Band ── */}
      <section className="relative overflow-hidden py-20 bg-gradient-to-br from-[#19212B] via-[#1c2530] to-[#0e1a18]">
        {/* Blob accents */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-20 left-1/4 w-64 h-64 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-56 h-56 rounded-full bg-teal-400/15 blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/30">
            <ArrowRight className="w-5 h-5 text-white" />
          </div>
          <LandingBottomCta />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 border-t border-[#E9DDCB] bg-white/80">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Image src="/logo-icon.png" alt="Pulse" width={16} height={16} className="w-4 h-4 object-contain opacity-60" />
            <span className="text-sm">© {new Date().getFullYear()} Pulse Appointments</span>
          </div>
          <LandingFooterLinks />
        </div>
      </footer>
    </div>
    </>
  );
}
