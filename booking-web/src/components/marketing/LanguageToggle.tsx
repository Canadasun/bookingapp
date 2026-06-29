import Link from "next/link";
import { Languages } from "lucide-react";

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
    "rounded-md px-2.5 py-1 text-sm font-semibold transition-colors";
  const active = "bg-violet-600 text-white";
  const inactive = "text-slate-600 hover:text-slate-900";
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5"
    >
      <Languages className="ml-1 h-4 w-4 text-slate-400" aria-hidden="true" />
      <Link
        href={enHref}
        hrefLang="en-CA"
        aria-current={locale === "en" ? "true" : undefined}
        className={`${base} ${locale === "en" ? active : inactive}`}
      >
        EN
      </Link>
      <Link
        href={frHref}
        hrefLang="fr-CA"
        aria-current={locale === "fr" ? "true" : undefined}
        className={`${base} ${locale === "fr" ? active : inactive}`}
      >
        FR
      </Link>
    </div>
  );
}
