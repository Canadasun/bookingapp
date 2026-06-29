import { describe, expect, it } from "vitest";
import en from "../i18n/dictionaries/en.json";
import fr from "../i18n/dictionaries/fr.json";
import { featureRig } from "../components/marketing/featureRig";
import { LOCALIZED_PATHS } from "../lib/hreflang";

const SLUGS = Object.keys(en.featurePages) as (keyof typeof en.featurePages)[];

// Each feature detail page is assembled from dictionary content + an icon rig,
// paired by index. These guards keep EN/FR aligned with each other and with the
// rig, and keep every comparison row's value count matching its column count
// (1 Pulse column + N competitors), so no cell renders against the wrong brand.
describe("feature sub-pages i18n contract", () => {
  it("covers all 8 slugs in both locales and the icon rig", () => {
    expect(SLUGS).toHaveLength(8);
    for (const slug of SLUGS) {
      expect(fr.featurePages[slug]).toBeTruthy();
      expect(featureRig[slug]).toBeTruthy();
      expect(LOCALIZED_PATHS.has(`/features/${slug}`)).toBe(true);
    }
  });

  it("keeps comparison rows sized to (Pulse + competitors) in both locales", () => {
    for (const slug of SLUGS) {
      for (const d of [en.featurePages[slug], fr.featurePages[slug]]) {
        const expected = d.competitors.length + 1;
        for (const row of d.comparison) expect(row.values).toHaveLength(expected);
      }
    }
  });

  it("keeps EN and FR structurally identical per page", () => {
    const shape = (o: unknown): unknown =>
      o && typeof o === "object" && !Array.isArray(o)
        ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, shape((o as Record<string, unknown>)[k])]))
        : Array.isArray(o)
          ? (o as unknown[]).map(shape)
          : "_";
    for (const slug of SLUGS) {
      expect(shape(fr.featurePages[slug])).toEqual(shape(en.featurePages[slug]));
    }
  });
});
