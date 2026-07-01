export type UILocale = "en" | "fr";

export const LOCALE_STORAGE_KEY = "pulse_dashboard_locale";

export function readStoredLocale(): UILocale | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(LOCALE_STORAGE_KEY);
    return value === "fr" || value === "en" ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: UILocale) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {}
}
