import type { Metadata } from "next";

const SITE = "https://www.pulseappointments.com";

// Logical (English) paths that have a French counterpart served at /fr<path>.
// Add a path here the moment its /fr/<path> page is created: both the English
// and French pages will then start emitting the fr-CA hreflang automatically,
// no per-page edits required.
export const LOCALIZED_PATHS = new Set<string>(["/security", "/pricing"]);

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
  const enUrl = `${SITE}${path}`;
  const frUrl = `${SITE}/fr${path}`;
  const hasFrench = LOCALIZED_PATHS.has(path);

  const languages: Record<string, string> = { "en-CA": enUrl };
  if (hasFrench) languages["fr-CA"] = frUrl;
  languages["x-default"] = enUrl;

  return {
    canonical: locale === "fr" ? frUrl : enUrl,
    languages,
  };
}
