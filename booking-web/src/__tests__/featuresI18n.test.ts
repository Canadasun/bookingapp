import { describe, expect, it } from "vitest";
import en from "../i18n/dictionaries/en.json";
import fr from "../i18n/dictionaries/fr.json";
import { LOCALIZED_PATHS } from "../lib/hreflang";

// FeaturesContent pairs an 8-entry in-code FEATURE_LINKS array (href + icon)
// with dict.features.items by index. Pin the count so a dropped/added card
// can't desync the link from its copy, and keep EN/FR structurally identical.
describe("features i18n contract", () => {
  it("has eight feature cards in both locales", () => {
    expect(en.features.items).toHaveLength(8);
    expect(fr.features.items).toHaveLength(8);
  });

  it("keeps the EN and FR features dictionaries structurally identical", () => {
    const shape = (o: unknown): unknown =>
      o && typeof o === "object" && !Array.isArray(o)
        ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, shape((o as Record<string, unknown>)[k])]))
        : Array.isArray(o)
          ? (o as unknown[]).map(shape)
          : "_";
    expect(shape(fr.features)).toEqual(shape(en.features));
  });

  it("serves /features as a localized hreflang cluster", () => {
    expect(LOCALIZED_PATHS.has("/features")).toBe(true);
  });
});
