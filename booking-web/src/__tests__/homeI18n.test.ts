import { describe, expect, it } from "vitest";
import en from "../i18n/dictionaries/en.json";
import fr from "../i18n/dictionaries/fr.json";
import { LOCALIZED_PATHS } from "../lib/hreflang";

// HomeContent pairs dictionary arrays with in-code icon/colour arrays by index
// (FEATURE_META×6, TOUR_ICONS×3, WORKFLOW_COLORS×3). A length mismatch would
// hand a row an undefined icon and crash render, so pin the counts in both
// locales — and keep EN/FR structurally identical.
describe("home i18n contract", () => {
  it("keeps index-coupled arrays at their expected length in both locales", () => {
    for (const d of [en.home, fr.home]) {
      expect(d.features.items).toHaveLength(6);
      expect(d.workflow.steps).toHaveLength(3);
      expect(d.tour.items).toHaveLength(3);
      expect(d.tour.mockup.services).toHaveLength(3);
      expect(d.tour.mockup.times).toHaveLength(4);
      expect(d.howItWorks.steps).toHaveLength(3);
      expect(d.trust).toHaveLength(3);
    }
  });

  it("keeps the EN and FR home dictionaries structurally identical", () => {
    const shape = (o: unknown): unknown =>
      o && typeof o === "object" && !Array.isArray(o)
        ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, shape((o as Record<string, unknown>)[k])]))
        : Array.isArray(o)
          ? (o as unknown[]).map(shape)
          : "_";
    expect(shape(fr.home)).toEqual(shape(en.home));
  });

  it("serves the home page as a localized hreflang cluster", () => {
    expect(LOCALIZED_PATHS.has("/")).toBe(true);
  });
});
