import Link from "next/link";
import { Lock, ShieldCheck, Eye, Server, CreditCard, Key, Bell, FileText, Mail, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/i18n/getDictionary";
import { LanguageToggle } from "./LanguageToggle";

// Section icons/links live in code; all copy comes from the dictionary so the
// page stays identical across locales except for the words.
const SECTION_ORDER: { key: string; Icon: LucideIcon; href?: string }[] = [
  { key: "encryption", Icon: Lock },
  { key: "passwords", Icon: Key },
  { key: "twofa", Icon: ShieldCheck },
  { key: "audit", Icon: Eye },
  { key: "loginAlerts", Icon: Bell },
  { key: "infra", Icon: Server },
  { key: "pci", Icon: CreditCard },
  { key: "pipeda", Icon: FileText, href: "/canadian-privacy" },
  { key: "breach", Icon: Bell },
  { key: "disclosure", Icon: Mail, href: "mailto:security@pulseappointments.com" },
];

// `altHref` is the same page in the other language; it tells us which locale
// this render is (the canonical EN page links to /fr/..., and vice versa).
export function SecurityContent({ dict, altHref }: { dict: Dictionary["security"]; altHref: string }) {
  const locale = altHref.startsWith("/fr") ? "en" : "fr";
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
            <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Appointments</span>
          </Link>
          <LanguageToggle locale={locale} enHref="/security" frHref="/fr/security" />
        </div>

        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">{dict.hero.title}</h1>
          <p className="text-lg text-slate-600 leading-relaxed">{dict.hero.intro}</p>
        </div>

        <div className="space-y-4">
          {SECTION_ORDER.map(({ key, Icon, href }) => {
            const s = dict.sections[key as keyof typeof dict.sections];
            if (!s) return null;
            return (
              <div key={key} className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 mb-1">{s.title}</h2>
                    <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
                    {href && "linkLabel" in s && s.linkLabel && (
                      <Link href={href} className="inline-block mt-2 text-sm font-medium text-violet-600 hover:underline">
                        {s.linkLabel} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-violet-200 bg-violet-50 p-6">
          <h2 className="text-base font-semibold text-violet-900 mb-2">{dict.contact.title}</h2>
          <p className="text-sm text-violet-800 mb-3">{dict.contact.body}</p>
          <Link href="mailto:security@pulseappointments.com" className="inline-block text-sm font-semibold text-violet-700 hover:text-violet-800 underline">
            security@pulseappointments.com
          </Link>
        </div>

        <p className="text-xs text-slate-400 mt-8 text-center">
          {dict.footer.lastReviewed} ·{" "}
          <Link href="/privacy" className="hover:underline">{dict.footer.privacy}</Link>{" "}·{" "}
          <Link href="/canadian-privacy" className="hover:underline">{dict.footer.canadianPrivacy}</Link>{" "}·{" "}
          <Link href="/terms" className="hover:underline">{dict.footer.terms}</Link>
        </p>
      </div>
    </div>
  );
}
