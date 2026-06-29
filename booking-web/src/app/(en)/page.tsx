import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import { verifyCookieValue } from "@/lib/cookie-sign";
import { Clock, Bell, CreditCard, CheckCircle2, ArrowRight, Zap, ClipboardList, Globe, Users, Star, ShieldCheck, MousePointerClick } from "lucide-react";
import { PLAN_DEFS } from "@/lib/plans";
import { getPlanLinks } from "@/lib/paymentLinks";

export const metadata: Metadata = {
  title: "Online Booking Software for Canadian Service Businesses | Pulse Appointments",
  description: "Pulse is the simplest online booking software for Canadian salons, spas, and service businesses. Automated reminders, deposit collection, and no-show protection — free to start.",
  openGraph: {
    title: "Online Booking Software for Canadian Service Businesses | Pulse Appointments",
    description: "Pulse is the simplest online booking software for Canadian salons, spas, and service businesses. Free to start.",
  },
};
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
    title: "Deposits & No-Show Protection",
    desc: "Collect deposits at booking on Basic+. Pro and Unlimited add automatic no-show and late-cancel fees charged to saved cards.",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    icon: ClipboardList,
    title: "Intake & Consent Forms",
    desc: "Collect health notes, allergies, or custom client questions right in the booking flow — no extra app needed.",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    icon: Globe,
    title: "Accept Apple Pay & Google Pay",
    desc: "Clients pay at checkout with the tap of a finger. Powered by Stripe with CAD support, no extra setup required.",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
  },
  {
    icon: Users,
    title: "Multi-Provider & Multi-Location",
    desc: "Add your whole team, each with their own calendar and services. Pro supports 2 locations; Unlimited supports up to 5.",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-700",
  },
];


export default async function LandingPage() {
  const { role, authed } = await sessionInfo();
  if (role === "ADMIN") redirect("/admin");
  if (role === "CLIENT") redirect("/my/dashboard");
  if ((role && role !== "CLIENT") || (authed && !role)) redirect("/dashboard");
  // Resolved Stripe Payment Link URLs per paid plan; falls back to /register.
  const planLinks = await getPlanLinks();

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
    name: "Pulse Appointments",
    url: "https://www.pulseappointments.com",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "https://www.pulseappointments.com/book?q={search_term_string}" },
      "query-input": "required name=search_term_string",
    },
  };
  const jsonLdApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Pulse Appointments",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Appointment Scheduling Software",
    operatingSystem: "Web, iOS, Android",
    url: "https://www.pulseappointments.com",
    description: "Online booking software for Canadian service businesses. Automated reminders, deposits, and no-show protection.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CAD",
      description: "Free plan available. Paid plans from $19 CAD/month.",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSite) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdApp) }} />
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
            The simplest online booking software for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600">
              Canadian service businesses
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

        {/* Product workflow card */}
        <div className="relative max-w-sm mx-auto px-6 pb-24">
          <div className="brand-panel rounded-[2rem] p-4 shadow-2xl shadow-amber-100">
            <div className="bg-[#19212B] rounded-[1.5rem] p-5 text-white">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[11px] text-white/45 uppercase tracking-widest mb-0.5">Booking workflow</p>
                  <p className="text-xl font-bold">Automation steps</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Zap className="w-4 h-4" />
                </div>
              </div>

              {/* Workflow cards */}
              <div className="space-y-2.5">
                {[
                  { step: "01", label: "Online booking", detail: "Client chooses a time", color: "bg-violet-400" },
                  { step: "02", label: "Deposit collected", detail: "Payment handled by Stripe", color: "bg-amber-400" },
                  { step: "03", label: "Reminder queued", detail: "Email and SMS on paid plans", color: "bg-teal-400" },
                ].map(({ step, label, detail, color }) => (
                  <div key={label} className="flex items-center gap-3 bg-white/[0.07] rounded-2xl px-4 py-3 hover:bg-white/[0.10] transition-colors">
                    <p className="text-xs font-bold text-white/50 w-10 shrink-0">{step}</p>
                    <div className={`w-1 h-8 rounded-full ${color} shrink-0`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{label}</p>
                      <p className="text-xs text-white/45 truncate">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Automation pill */}
              <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-semibold shadow-lg shadow-amber-500/25">
                <Bell className="w-4 h-4" /> Booking workflow automated
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

      {/* ── Product tour ── */}
      <section className="py-20 border-y border-[#E9DDCB] bg-white">
        <div className="max-w-6xl mx-auto px-6 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-3">Product tour</p>
            <h2 className="text-3xl font-bold text-ink mb-4">See the booking flow before you commit</h2>
            <p className="text-slate-500 leading-relaxed mb-6">
              Pulse is built around the work that actually affects revenue: clients book online, pay deposits when needed, get reminders automatically, and leave real reviews after completed appointments.
            </p>
            <div className="space-y-3">
              {[
                { icon: MousePointerClick, title: "Client picks a service", desc: "Your public booking page shows services, staff, locations, and available times." },
                { icon: CreditCard, title: "Deposit or card hold protects the slot", desc: "Paid plans can collect deposits and save cards for no-show protection." },
                { icon: Star, title: "Completed visits become review requests", desc: "Pulse sends signed review links so published feedback comes from real appointments." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                    <Icon className="h-4 w-4 text-violet-700" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="/demo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                View product tour <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a href="/reviews" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E9DDCB] bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-violet-50 transition-colors">
                Review collection
              </a>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[#E9DDCB] bg-[#F8F5EF] p-4 shadow-xl shadow-amber-100/60">
            <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="ml-3 rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">pulseappointments.com/book/studio</span>
              </div>
              <div className="grid md:grid-cols-[0.8fr_1.2fr]">
                <div className="bg-[#19212B] p-5 text-white">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500" />
                    <div>
                      <p className="text-sm font-bold">Northline Studio</p>
                      <p className="text-xs text-white/45">Toronto, ON</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {["Lash lift", "Brow shape", "Facial"].map((service, index) => (
                      <div key={service} className="rounded-2xl bg-white/[0.07] p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{service}</span>
                          <span className="text-xs text-white/50">{index === 0 ? "$95" : index === 1 ? "$45" : "$120"}</span>
                        </div>
                        <p className="mt-1 text-xs text-white/40">{index === 0 ? "Deposit required" : "Online booking enabled"}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Available times</p>
                      <p className="text-lg font-bold text-slate-900">Thursday, June 25</p>
                    </div>
                    <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {["10:00 AM", "11:30 AM", "1:00 PM", "3:15 PM"].map((time, index) => (
                      <div key={time} className={index === 2 ? "rounded-xl bg-violet-600 px-3 py-3 text-center text-sm font-semibold text-white" : "rounded-xl border border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700"}>
                        {time}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900">$25 deposit collected</p>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-700">Confirmation, reminder, and review request are queued automatically.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      {/* ── Social proof strip ── */}
      <section className="py-16 bg-gradient-to-b from-[#FFFAF2] to-white border-t border-[#E9DDCB]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-sm text-slate-500 mb-6">Trusted by service businesses across Canada</p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
            {["Salons", "Spas", "Lash Studios", "Massage Therapy", "Wellness Clinics", "Barbers"].map((niche) => (
              <span key={niche}>{niche}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing comparison ── */}
      <section className="py-24 bg-white/60 border-t border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-ink mb-3">Plans for every stage</h2>
            <p className="text-slate-500 max-w-md mx-auto">
              Start free, no credit card. Upgrade the moment you need it.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {PLAN_DEFS.map((plan) => {
              const links = plan.id === "FREE" ? undefined : planLinks[plan.id];
              const ctaHref = plan.price > 0 ? (links?.month ?? plan.href) : plan.href;
              return (
              <div
                key={plan.id}
                className={
                  plan.highlight
                    ? "rounded-2xl border-2 border-violet-500 bg-white p-6 shadow-lg shadow-violet-100 relative flex flex-col"
                    : "rounded-2xl border border-[#E9DDCB] bg-white p-6 shadow-sm flex flex-col"
                }
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full tracking-wider uppercase">
                    Popular
                  </span>
                )}
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">{plan.name}</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {plan.price === 0 ? "Free" : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && <span className="text-xs text-slate-400 mb-1">/mo</span>}
                </div>
                <p className="text-xs text-slate-500 mb-5 leading-relaxed flex-1">{plan.desc}</p>
                <a
                  href={ctaHref}
                  className={
                    plan.highlight
                      ? "block text-center py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors"
                      : "block text-center py-2.5 rounded-xl border border-[#E9DDCB] text-slate-700 font-semibold text-sm hover:bg-violet-50 transition-colors"
                  }
                >
                  {plan.cta}
                </a>
              </div>
              );
            })}
          </div>
          <p className="text-center text-sm text-slate-400">
            See the full feature breakdown on our{" "}
            <a href="/pricing" className="text-violet-600 hover:underline font-medium">pricing page →</a>
          </p>
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
