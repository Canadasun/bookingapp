import Link from "next/link";
import { cookies } from "next/headers";
import { Calendar, Bell, CreditCard, Clock, Star, Shield, ArrowRight, Sparkles } from "lucide-react";
import { LandingAuthCta, LandingResources, LandingSolutions, LandingHeroCta, LandingBottomCta, LandingFooterLinks } from "@/components/LandingClient";
import { LoggedInHome } from "@/components/LoggedInHome";

// Decode the role from the (non-HttpOnly) booking_user cookie, server-side, so a
// signed-in user gets their dedicated home with no flash of the marketing page.
// `authed` falls back to the session token/refresh cookies: on mobile the readable
// booking_user cookie can briefly drop while the httpOnly session cookies survive —
// without this an owner who taps "home" would be shown the signed-out marketing page.
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

const features = [
  { icon: Clock,       title: "24/7 Online Booking",       desc: "Clients book appointments any time — no phone tag, no back-and-forth." },
  { icon: Bell,        title: "Automated Reminders",        desc: "Email and SMS reminders reduce no-shows by up to 80%." },
  { icon: CreditCard,  title: "Secure Deposits",            desc: "Collect deposits at booking to protect your time and revenue." },
];

const stats = [
  { value: "10k+", label: "Businesses" },
  { value: "2M+",  label: "Appointments booked" },
  { value: "80%",  label: "Reduction in no-shows" },
];

export default async function LandingPage() {
  // Signed-in owners/staff/admins get a dedicated home, not the marketing page.
  // If a session exists but the role cookie was dropped (mobile), still show the
  // logged-in home rather than flashing the marketing page.
  const { role, authed } = await sessionInfo();
  if ((role && role !== "CLIENT") || (authed && !role)) return <LoggedInHome />;

  return (
    <div className="flex flex-col min-h-screen brand-shell">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/82 backdrop-blur-xl border-b border-[#E9DDCB]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-violet-600 shadow-lg shadow-violet-200 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-ink">Pulse</span>
          </div>
          <LandingAuthCta />
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-24 lg:py-28 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
          <div>
          <div className="inline-flex items-center gap-2 bg-white/80 border border-violet-200 text-violet-800 text-sm font-semibold px-4 py-1.5 rounded-full mb-8 shadow-sm">
            <Star className="w-4 h-4" />
            Loved by 10,000+ businesses
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-ink tracking-tight leading-tight mb-6">
            Pulse
            <span className="block text-4xl sm:text-5xl mt-2 text-slate-700">booking made</span>{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600">
              simple
            </span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed">
            Let your clients book appointments online 24/7. Automated reminders, deposit collection,
            and a beautiful dashboard — all in one place.
          </p>
          <LandingHeroCta />

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-lg">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/78 border border-[#E9DDCB] px-4 py-5 shadow-sm">
                <p className="text-3xl font-bold text-violet-700">{s.value}</p>
                <p className="text-sm text-slate-600 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          </div>

          <div className="relative">
            <div className="brand-panel rounded-[2rem] p-5">
              <div className="rounded-[1.5rem] bg-[#19212B] p-5 text-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-sm text-white/55">Today</p>
                    <p className="text-2xl font-bold">8 appointments</p>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-violet-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
                <div className="space-y-3 pt-5">
                  {["Color consultation", "Haircut", "Follow-up"].map((name, i) => (
                    <div key={name} className="flex items-center gap-3 rounded-2xl bg-white/8 border border-white/10 p-4">
                      <div className="w-12 text-sm font-semibold text-violet-200">{["9:30", "11:00", "2:15"][i]}</div>
                      <div className="h-10 w-1 rounded-full bg-violet-400" />
                      <div className="flex-1">
                        <p className="font-semibold">{name}</p>
                        <p className="text-sm text-white/55">{["Maya Chen", "Amara Lee", "Jordan Smith"][i]}</p>
                      </div>
                      <span className="rounded-full bg-[#E6F4F3] px-3 py-1 text-xs font-bold text-[#0F6468]">Confirmed</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logged-in owners: account-aware setup shortcuts + business solutions */}
      <LandingResources />
      <LandingSolutions />

      {/* Features */}
      <section className="py-24 bg-white/72 border-y border-[#E9DDCB]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-ink mb-4">
              Everything you need to run your schedule
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Built for solo professionals — pet groomers, lash &amp; brow artists, hair stylists, estheticians, and the appointments you keep coming back for.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-8 rounded-2xl bg-white border border-[#E9DDCB] hover:shadow-xl hover:shadow-violet-100 transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-violet-700" />
                </div>
                <h3 className="text-lg font-semibold text-ink mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="py-20 bg-[#19212B]">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <Shield className="w-10 h-10 text-violet-300 mx-auto mb-4" />
          <LandingBottomCta />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-[#E9DDCB] bg-white/80">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">© {new Date().getFullYear()} Pulse</span>
          </div>
          <LandingFooterLinks />
        </div>
      </footer>
    </div>
  );
}
