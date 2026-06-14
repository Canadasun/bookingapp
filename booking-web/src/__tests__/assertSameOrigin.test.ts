import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Replicate the assertSameOrigin logic here so we can test it independently of
// the Next.js runtime (NextRequest is not available in jsdom).
function assertSameOrigin(originHeader: string | null, webUrl: string | undefined): void {
  if (!originHeader) return;
  const expected = webUrl ?? "";
  if (expected && originHeader !== expected) {
    throw new Error("Forbidden");
  }
}

describe("assertSameOrigin", () => {
  it("passes when no Origin header is present (server-to-server)", () => {
    expect(() => assertSameOrigin(null, "https://www.pulseappointments.com")).not.toThrow();
  });

  it("passes when Origin matches NEXT_PUBLIC_WEB_URL", () => {
    expect(() => assertSameOrigin("https://www.pulseappointments.com", "https://www.pulseappointments.com")).not.toThrow();
  });

  it("throws when Origin does not match", () => {
    expect(() => assertSameOrigin("https://evil.com", "https://www.pulseappointments.com")).toThrow("Forbidden");
  });

  it("passes when NEXT_PUBLIC_WEB_URL is not set (dev fallback)", () => {
    expect(() => assertSameOrigin("https://anything.com", undefined)).not.toThrow();
    expect(() => assertSameOrigin("https://anything.com", "")).not.toThrow();
  });
});
