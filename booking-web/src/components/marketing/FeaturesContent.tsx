import Link from "next/link";
import Image from "next/image";
import { Bell, ClipboardList, CreditCard, MapPin, MessageSquare, ShieldCheck, Star, Users, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/config";
import { LanguageToggle } from "./LanguageToggle";

const SITE = "https://www.pulseappointments.com";

// Each feature's link + icon lives in code, paired by index with the dictionary
const FEATURE_LINKS: { href: string; Icon: LucideIcon }[] = [
  { href: "/features/online-booking", Icon: CreditCard },
  { href: "/features/deposits", Icon: ShieldCheck },
  { href: "/features/no-show-protection", Icon: ShieldCheck },
  { href: "/features/sms-reminders", Icon: Bell },
  { href: "/features/client-management", Icon: Users },
  { href: "/features/intake-forms", Icon: ClipboardList },
  { href: "/features/multi-location", Icon: MapPin },
  { href: "/features/reviews", Icon: Star },
];

export function FeaturesContent({ dict, locale }: { dict: Dictionary["features"]; locale: Locale }) {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: dict.breadcrumb.home, item: SITE },
      { "@type": "ListItem", position: 2, name: dict.breadcrumb.self, item: `${SITE}/features` },
    ],
  };
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: dict.og.title,
    url: `${SITE}/features`,
    hasPart: FEATURE_LINKS.map(({ href }, i) => ({
      "@type": "WebPage",
      name: dict.items[i].title,
      url: `${SITE}${href}`,
    })),
  };

  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF] text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbSchema, collectionSchema]) }} />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
        <Link href={locale === "fr" ? "/fr" : "/"} className="inline-flex items-center gap-2">
          <Image src="/logo-icon.png" alt="Pulse" width={28} height={28} className="h-7 w-7 object-contain" />
          <span className="text-lg font-bold tracking-tight text-slate-900">Pulse Appointments</span>
        </Link>
        <LanguageToggle locale={locale} enHref="/features" frHref="/fr/features" label={dict.toggleLabel} />
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600">{dict.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">{dict.h1}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">{dict.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={`/register${locale === "fr" ? "?lang=fr" : ""}`} className="inline-flex items-center justify-center rounded-lg bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800">
              {dict.startFree}
            </Link>
            <Link href={locale === "fr" ? "/fr/pricing" : "/demo"} className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              {dict.viewDemo}
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-[#E9DDCB] bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_LINKS.map(({ href, Icon }, i) => (
            <Link key={href} href={locale === "fr" ? `/fr${href}` : href} className="group rounded-lg border border-slate-200 p-5 transition-colors hover:border-violet-300 hover:bg-violet-50/40">
              <Icon className="h-5 w-5 text-violet-700" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold text-slate-950 group-hover:text-violet-800">{dict.items[i].title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{dict.items[i].desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-lg border border-[#E9DDCB] bg-white p-6">
          <MessageSquare className="h-5 w-5 text-violet-700" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-slate-950">{dict.together.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{dict.together.body}</p>
        </div>
      </section>
    </main>
  );
}
