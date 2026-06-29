import { describe, expect, it } from "vitest";
import { dashboardEn } from "@/i18n/dashboard/en";
import { dashboardFr } from "@/i18n/dashboard/fr";

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, shape(child)]));
  }
  return typeof value;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("dashboard dictionaries", () => {
  it("keeps exact key and collection parity", () => {
    expect(shape(dashboardFr)).toEqual(shape(dashboardEn));
  });

  it("contains no blank translated values", () => {
    expect(strings(dashboardFr).every((value) => value.trim().length > 0)).toBe(true);
  });

  it("keeps interpolation tokens aligned", () => {
    const tokens = (value: string) => [...value.matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort();
    const en = strings(dashboardEn);
    const fr = strings(dashboardFr);
    expect(fr).toHaveLength(en.length);
    en.forEach((value, index) => expect(tokens(fr[index])).toEqual(tokens(value)));
  });
});
