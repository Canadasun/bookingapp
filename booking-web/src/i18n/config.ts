// Supported locales for the public, SEO-indexed site. English stays at the
// site root (e.g. /security); French lives under /fr (e.g. /fr/security).
export const locales = ["en", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export const localeLabels: Record<Locale, string> = { en: "English", fr: "Français" };
// BCP-47 tags for <html lang> and hreflang.
export const localeHtmlLang: Record<Locale, string> = { en: "en-CA", fr: "fr-CA" };
