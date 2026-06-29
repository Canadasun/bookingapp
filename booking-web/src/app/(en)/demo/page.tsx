import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import Link from "next/link";
import { ArrowRight, Bell, CalendarCheck, CreditCard, MessageSquare, Star } from "lucide-react";

export const metadata: Metadata = {
  title: "Product Demo: Online Booking, Deposits, Reminders | Pulse Appointments",
  description: "See how Pulse Appointments handles online booking, deposits, reminders, reviews, and client follow-up for Canadian service businesses.",
  alternates: buildAlternates("/demo"),
  openGraph: {
    title: "Pulse Appointments Product Demo",
    description: "Tour the booking flow built for Canadian service businesses.",
    url: "https://www.pulseappointments.com/demo",
  },
};

const demoSteps = [
  {
    icon: CalendarCheck,
    title: "Booking page",
    copy: "Clients choose a service, provider, location, and available time from your public booking page.",
  },
  {
    icon: CreditCard,
    title: "Payment protection",
    copy: "Deposits and saved cards protect high-value appointments from last-minute cancellations.",
  },
  {
    icon: Bell,
    title: "Automated reminders",
    copy: "Confirmation, reminder, and update messages are sent without another tool.",
  },
  {
    icon: Star,
    title: "Review request",
    copy: "Completed appointments can trigger signed review requests, so published feedback is tied to real visits.",
  },
];

const productSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Pulse Appointments",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  url: "https://www.pulseappointments.com/demo",
  description: "Online booking software for Canadian service businesses with deposits, reminders, reviews, and client messaging.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://www.pulseappointments.com" },
    { "@type": "ListItem", position: 2, name: "Demo", item: "https://www.pulseappointments.com/demo" },
  ],
};

export default function DemoPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF] text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([productSchema, breadcrumbSchema]) }} />
      <section className="border-b border-[#E9DDCB] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Product demo</p>
          <div className="mt-4 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                See how Pulse turns booking traffic into protected appointments
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                This tour shows the core workflow: online booking, deposit collection, automated reminders, messaging, and review requests for Canadian appointment-based businesses.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800">
                  Start free <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/features/deposits" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                  Deposit feature
                </Link>
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-[#E9DDCB] bg-[#19212B] p-4 shadow-2xl shadow-amber-100">
              <div className="rounded-[1.25rem] bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Owner dashboard</p>
                    <p className="text-lg font-bold text-slate-950">Today at a glance</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Protected</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Bookings", "8", "3 deposits collected"],
                    ["Revenue protected", "$175", "Card on file"],
                    ["Reminders", "14", "SMS + email queued"],
                    ["Reviews", "2", "Requests sent"],
                  ].map(([label, value, detail]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
                      <p className="mt-1 text-xs text-slate-500">{detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="mt-0.5 h-5 w-5 text-violet-700" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-violet-950">Client message ready</p>
                      <p className="mt-1 text-sm leading-6 text-violet-800">Your appointment is confirmed for 3:15 PM. Your $25 deposit has been applied.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-4 md:grid-cols-4">
          {demoSteps.map(({ icon: Icon, title, copy }) => (
            <div key={title} className="rounded-lg border border-[#E9DDCB] bg-white p-5">
              <Icon className="h-5 w-5 text-violet-700" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
