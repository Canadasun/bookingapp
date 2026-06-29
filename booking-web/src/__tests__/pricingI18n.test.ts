import { describe, expect, it } from "vitest";
import en from "../i18n/dictionaries/en.json";
import fr from "../i18n/dictionaries/fr.json";
import { PLAN_FEATURES, PLAN_ORDER } from "../lib/plans";
import { LOCALIZED_PATHS } from "../lib/hreflang";

// PricingContent maps feature rows to dictionary strings by array index and
// plan rows by id. These guards stop the dictionaries from silently drifting
// out of alignment with the plan matrix (which would mislabel a paid feature).
describe("pricing i18n contract", () => {
  it("has one feature label per plan-matrix row in both locales", () => {
    expect(en.pricing.features).toHaveLength(PLAN_FEATURES.length);
    expect(fr.pricing.features).toHaveLength(PLAN_FEATURES.length);
  });

  it("defines copy for every plan id in both locales", () => {
    for (const id of PLAN_ORDER) {
      expect(en.pricing.plans[id]?.name).toBeTruthy();
      expect(fr.pricing.plans[id]?.name).toBeTruthy();
    }
  });

  it("keeps the EN and FR pricing dictionaries structurally identical", () => {
    const shape = (o: unknown): unknown =>
      o && typeof o === "object" && !Array.isArray(o)
        ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, shape((o as Record<string, unknown>)[k])]))
        : Array.isArray(o)
          ? "[]"
          : "_";
    expect(shape(fr.pricing)).toEqual(shape(en.pricing));
  });

  it("serves /pricing as a localized hreflang cluster", () => {
    expect(LOCALIZED_PATHS.has("/pricing")).toBe(true);
  });
});
