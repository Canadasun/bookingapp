import { describe, it, expect } from "vitest";
import { safeNextPath, formatPhoneInput, normalizePhoneE164 } from "@/lib/utils";

describe("safeNextPath", () => {
  it("allows a simple absolute path", () => {
    expect(safeNextPath("/dashboard", "/")).toBe("/dashboard");
  });

  it("returns fallback for null/undefined", () => {
    expect(safeNextPath(null, "/")).toBe("/");
    expect(safeNextPath(undefined, "/")).toBe("/");
  });

  it("rejects protocol-relative URLs (open-redirect)", () => {
    expect(safeNextPath("//evil.com", "/")).toBe("/");
  });

  it("rejects backslash bypass (open-redirect)", () => {
    expect(safeNextPath("/\\evil.com", "/")).toBe("/");
  });

  it("rejects internal /api/ paths", () => {
    expect(safeNextPath("/api/auth/login", "/")).toBe("/");
  });

  it("allows nested paths", () => {
    expect(safeNextPath("/my/dashboard/settings", "/")).toBe("/my/dashboard/settings");
  });
});

describe("formatPhoneInput", () => {
  it("formats a 10-digit number", () => {
    expect(formatPhoneInput("4165551234")).toBe("+1 (416) 555-1234");
  });

  it("returns empty string for empty input", () => {
    expect(formatPhoneInput("")).toBe("");
  });
});

describe("normalizePhoneE164", () => {
  it("converts 10-digit to E.164", () => {
    expect(normalizePhoneE164("4165551234")).toBe("+14165551234");
  });

  it("converts displayed format to E.164", () => {
    expect(normalizePhoneE164("+1 (416) 555-1234")).toBe("+14165551234");
  });

  it("returns empty string for empty input", () => {
    expect(normalizePhoneE164("")).toBe("");
  });
});
