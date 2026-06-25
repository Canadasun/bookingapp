import Image from "next/image";
import Link from "next/link";
import { Bell, CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";

interface CityLandingPageProps {
  city: string;
  province: string;
  titleKeyword: string;
  primaryAudience: string;
  localAngle: string;
}

const SITE_URL = "https://www.pulseappointments.com";

const niches = [
  { label: "Hair Salons", href: "/for/salons" },
  { label: "Barber Shops", href: "/for/barbers" },
  { label: "Spas", href: "/for/spas" },
  { label: "Nail Salons", href: "/for/nail-techs" },
  { label: "Massage Therapy", href: "/for/massage-therapists" },
  { label: "Wellness Studios", href: "/for/wellness" },
];

export function cityBreadcrumb(city: string, slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: `Booking Software for ${city}`, item: `${SITE_URL}/for/${slug}` },
    ],
  };
}

export function CityLandingPage({
  city,
  province,
  titleKeyword,
  primaryAudience,
  localAngle,
}: CityLandingPageProps) {
  const features = [
    {
      icon: CreditCard,
      title: "CAD pricing",
      body: "Every plan is priced in Canadian dollars, with no USD conversion or exchange-rate surprises.",
    },
    {
      icon: ShieldCheck,
      title: "No-show protection",
      body: "Collect deposits and keep a card on file so missed appointments do not quietly erase your revenue.",
    },
    {
      icon: Bell,
      title: "Automated reminders",
      body: "Send email and SMS reminders before every appointment, without adding front-desk work.",
    },
  ];

  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <nav className="bg-white/80 backdrop-blur-xl border-b border-[#E9DDCB] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-slate-900 tracking-tight">Pulse Booking</span>
          </Link>
          <Link href="/register" className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors">
            Get started free
          </Link>
        </div>
      </nav>

      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-white border border-[#E9DDCB] text-sm font-semibold text-slate-700 px-4 py-1.5 rounded-full mb-8 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-violet-600" />
          {city}, {province}
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          {titleKeyword} for{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600">
            {city} service businesses
          </span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Pulse helps {primaryAudience} in {city} take bookings online, collect deposits, send reminders, and protect revenue with Canada-first pricing.
        </p>
        <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200">
          Get started free
        </Link>
        <p className="mt-4 text-sm text-slate-400">No credit card required · Cancel anytime · CAD pricing</p>
      </section>

      <section className="py-16 bg-white/60 border-y border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">Why {city} businesses choose Pulse</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-violet-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Built for local appointment workflows</h2>
          <p className="text-slate-500 mb-10">{localAngle}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {niches.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="px-4 py-2 bg-white rounded-full border border-[#E9DDCB] text-sm font-medium text-slate-700 hover:border-violet-400 hover:text-violet-700 transition-colors shadow-sm"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#19212B]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Start taking {city} bookings today</h2>
          <p className="text-white/60 mb-8">Create your free account in 2 minutes. No credit card required.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-8 py-4 rounded-xl hover:bg-violet-50 transition-colors">
            Get started free
          </Link>
        </div>
      </section>
    </main>
  );
}
