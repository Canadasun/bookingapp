import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALIZED_PATHS, buildAlternates } from "@/lib/hreflang";
import { sharedFrenchMetadata, sharedMetadata } from "@/lib/rootMetadata";

const appRoot = join(process.cwd(), "src", "app");
const sitemapSource = readFileSync(
  join(appRoot, "(en)", "generated-sitemap", "route.ts"),
  "utf8",
);
const bookingLayoutSource = readFileSync(
  join(appRoot, "(en)", "book", "[slug]", "layout.tsx"),
  "utf8",
);

function pageExists(locale: "en" | "fr", path: string) {
  const segments = path === "/" ? [] : path.slice(1).split("/");
  const root = locale === "fr"
    ? join(appRoot, "(fr)", "fr")
    : join(appRoot, "(en)");
  const exact = join(root, ...segments, "page.tsx");
  try {
    readFileSync(exact);
    return true;
  } catch {
    // French industry and comparison pages intentionally share dynamic routes.
    const dynamic = segments.length > 1
      ? join(root, ...segments.slice(0, -1), "[slug]", "page.tsx")
      : "";
    if (!dynamic) return false;
    try {
      readFileSync(dynamic);
      return true;
    } catch {
      return false;
    }
  }
}

describe("bilingual SEO coverage", () => {
  it("keeps every localized route implemented in both languages and in the sitemap", () => {
    for (const path of LOCALIZED_PATHS) {
      expect(pageExists("en", path), `missing English page for ${path}`).toBe(true);
      expect(pageExists("fr", path), `missing French page for ${path}`).toBe(true);
    }
  });

  it("emits reciprocal Canadian hreflang links", () => {
    expect(buildAlternates("/pricing", "en")?.languages).toMatchObject({
      "en-CA": "https://www.pulseappointments.com/pricing",
      "fr-CA": "https://www.pulseappointments.com/fr/pricing",
      "x-default": "https://www.pulseappointments.com/pricing",
    });
    expect(buildAlternates("/pricing", "fr")?.canonical).toBe(
      "https://www.pulseappointments.com/fr/pricing",
    );
    expect(sitemapSource).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(sitemapSource).toContain('hreflang="fr-CA"');
    expect(sitemapSource).toContain("Array.from(LOCALIZED_PATHS");
  });

  it("sets reciprocal OpenGraph locales", () => {
    expect(sharedMetadata.openGraph).toMatchObject({
      locale: "en_CA",
      alternateLocale: ["fr_CA"],
    });
    expect(sharedFrenchMetadata.openGraph).toMatchObject({
      locale: "fr_CA",
      alternateLocale: ["en_CA"],
    });
  });

  it("describes public booking pages as bilingual local businesses", () => {
    expect(bookingLayoutSource).toContain('"@type": "LocalBusiness"');
    expect(bookingLayoutSource).toContain('inLanguage: ["en-CA", "fr-CA"]');
    expect(bookingLayoutSource).toContain('"@type": "ReserveAction"');
    expect(bookingLayoutSource).toContain('alternateLocale: ["fr_CA"]');
  });
});
