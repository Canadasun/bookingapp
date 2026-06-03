import Link from "next/link";
import { Calendar, Bell, CreditCard, Clock, Star, Shield, ArrowRight, Sparkles } from "lucide-react";

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

export default function LandingPage() {
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
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-violet-700 transition-colors">
              Sign in
            </Link>
            <Link href="/register" className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors">
              Get started
            </Link>
          </div>
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
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-violet-600 text-white text-base font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-xl shadow-violet-200">
              <Sparkles className="w-5 h-5" />
              Get started free
            </Link>
            <Link href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/90 text-slate-800 text-base font-semibold px-8 py-4 rounded-xl border border-[#E9DDCB] hover:bg-violet-50 transition-colors">
              Sign in <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

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

      {/* Features */}
      <section className="py-24 bg-white/72 border-y border-[#E9DDCB]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-ink mb-4">
              Everything you need to run your schedule
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Built for service businesses — salons, clinics, coaches, and more.
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
          <h2 className="text-3xl font-bold text-white mb-4">Ready to simplify your scheduling?</h2>
          <p className="text-white/60 mb-8">Join thousands of businesses using Pulse.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register"
              className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-8 py-4 rounded-xl hover:bg-violet-50 transition-colors">
              <Sparkles className="w-5 h-5" />
              Get started free
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-2 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-colors">
              Sign in <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-[#E9DDCB] bg-white/80">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">© {new Date().getFullYear()} Pulse</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/register" className="hover:text-indigo-600 transition-colors">Get started</Link>
            <Link href="/login" className="hover:text-indigo-600 transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
