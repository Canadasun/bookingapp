"use client";

import Link from "next/link";
import { CanadaMark } from "./CanadaMark";

// Remember the visitor's explicit language choice so the logged-in dashboard
// (which has its own EN/FR toggle keyed on this same value) opens in the same
// language after sign-in, instead of always defaulting to English.
function rememberLocale(locale: "en" | "fr") {
  try { localStorage.setItem("pulse_dashboard_locale", locale); } catch {}
}

// A two-option EN / FR segmented control. The site defaults to English at the
// canonical URLs; this toggle lets a visitor deliberately switch to the French
// version of the page they're on (and back). It is a plain pair of links — no
// cookies, no Accept-Language sniffing, no auto-redirect — so the language a
// visitor sees is always their explicit choice, and both URLs stay crawlable.
//
// `locale` is the page you are currently on; `enHref` / `frHref` are the same
// page in each language.
export function LanguageToggle({
  locale,
  enHref,
  frHref,
  label = "Language",
}: {
  locale: "en" | "fr";
  enHref: string;
  frHref: string;
  label?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-medium tracking-[0.16em] transition-all min-w-0";
  const active = "bg-[#D80621] text-white shadow-sm";
  const inactive = "text-slate-500 hover:text-slate-900";
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-0.5 shadow-sm"
    >
      <span className="ml-1 inline-flex items-center justify-center rounded-full bg-slate-50 px-1.5 py-1">
        <CanadaMark className="h-3.5 w-[1.05rem]" />
      </span>
      <Link
        href={enHref}
        hrefLang="en-CA"
        onClick={() => rememberLocale("en")}
        aria-current={locale === "en" ? "page" : undefined}
        className={`${base} ${locale === "en" ? active : inactive}`}
      >
        EN
      </Link>
      <Link
        href={frHref}
        hrefLang="fr-CA"
        onClick={() => rememberLocale("fr")}
        aria-current={locale === "fr" ? "page" : undefined}
        className={`${base} ${locale === "fr" ? active : inactive}`}
      >
        FR
      </Link>
    </div>
  );
}
