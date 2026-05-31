import Link from "next/link";
import { Calendar, Bell, CreditCard, Clock, Star, Shield } from "lucide-react";

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
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <span className="text-lg font-bold text-slate-900">BookingApp</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
              Business login
            </Link>
            <Link href="/book" className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors">
              Book now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="max-w-6xl mx-auto px-6 py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
            <Star className="w-4 h-4" />
            Loved by 10,000+ businesses
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
            Booking made{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              simple
            </span>
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10">
            Let your clients book appointments online 24/7. Automated reminders, deposit collection,
            and a beautiful dashboard — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/book"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-violet-600 text-white text-base font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200">
              <Calendar className="w-5 h-5" />
              Book an appointment
            </Link>
            <Link href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-slate-700 text-base font-semibold px-8 py-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              Business login →
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-bold text-indigo-600">{s.value}</p>
                <p className="text-sm text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Everything you need to run your schedule
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Built for service businesses — salons, clinics, coaches, and more.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-8 rounded-2xl bg-slate-50 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="py-20 bg-indigo-600">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <Shield className="w-10 h-10 text-indigo-300 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-4">Ready to simplify your scheduling?</h2>
          <p className="text-indigo-200 mb-8">Join thousands of businesses using BookingApp.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/book"
              className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-8 py-4 rounded-xl hover:bg-violet-50 transition-colors">
              <Calendar className="w-5 h-5" />
              Book an appointment
            </Link>
            <Link href="/login"
              className="inline-flex items-center gap-2 border border-indigo-400 text-indigo-100 font-semibold px-8 py-4 rounded-xl hover:bg-indigo-700 transition-colors">
              Business login →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">© {new Date().getFullYear()} BookingApp</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/book" className="hover:text-indigo-600 transition-colors">Book</Link>
            <Link href="/login" className="hover:text-indigo-600 transition-colors">Business login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
