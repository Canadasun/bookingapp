import type { Metadata } from "next";

const SITE = "https://www.pulseappointments.com";

// Logical (English) paths that have a French counterpart served at /fr<path>.
// Add a path here the moment its /fr/<path> page is created: both the English
// and French pages will then start emitting the fr-CA hreflang automatically,
// no per-page edits required.
export const LOCALIZED_PATHS = new Set<string>([
  "/",
  "/security",
  "/pricing",
  "/terms",
  "/privacy",
  "/canadian-privacy",
  "/features",
  "/features/online-booking",
  "/features/deposits",
  "/features/no-show-protection",
  "/features/sms-reminders",
  "/features/client-management",
  "/features/intake-forms",
  "/features/multi-location",
  "/features/reviews",
  "/for/salons",
  "/for/barbers",
  "/for/lash-techs",
  "/for/estheticians",
  "/for/massage-therapists",
  "/for/pet-groomers",
  "/for/consultants",
  "/for/wellness",
  "/for/mobile-services",
  "/for/personal-trainers",
  "/for/hair-stylists",
  "/for/nail-techs",
  "/for/spas",
  "/for/yoga-studios",
]);

export type Locale = "en" | "fr";

/**
 * Build the canonical + hreflang `alternates` block for a marketing page.
 *
 * `path` is the logical English path (e.g. "/features"). English renders at
 * that path; the French counterpart, when it exists, lives at "/fr<path>".
 * Every page self-references en-CA and x-default; fr-CA is emitted only once a
 * French translation exists (tracked in {@link LOCALIZED_PATHS}), at which
 * point both locales reciprocate.
 */
export function buildAlternates(path: string, locale: Locale = "en"): Metadata["alternates"] {
  // The home page is path "/"; its URLs are the bare root and "/fr" (no trailing
  // slash), so drop the slash there. Every other path is "/something".
  const suffix = path === "/" ? "" : path;
  const enUrl = `${SITE}${suffix}`;
  const frUrl = `${SITE}/fr${suffix}`;
  const hasFrench = LOCALIZED_PATHS.has(path);

  const languages: Record<string, string> = { "en-CA": enUrl };
  if (hasFrench) languages["fr-CA"] = frUrl;
  languages["x-default"] = enUrl;

  return {
    canonical: locale === "fr" ? frUrl : enUrl,
    languages,
  };
}
