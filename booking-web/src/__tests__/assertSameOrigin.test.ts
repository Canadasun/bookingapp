import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/same-origin";

function request(headers: Record<string, string> = {}, nextUrlOrigin = "http://localhost:3000") {
  return { headers: new Headers(headers), nextUrl: { origin: nextUrlOrigin } } as unknown as NextRequest;
}

describe("assertSameOrigin", () => {
  it("accepts matching browser requests", () => {
    expect(() => assertSameOrigin(request({
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      cookie: "booking_refresh=token",
    }))).not.toThrow();
  });

  it("rejects cross-site browser requests", () => {
    expect(() => assertSameOrigin(request({
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    }))).toThrow();
  });

  it("allows Safari same-origin requests with cookies but no Origin", () => {
    // Safari omits Origin on same-origin fetch. SameSite=Lax is the backstop.
    expect(() => assertSameOrigin(request({ cookie: "booking_refresh=token" }))).not.toThrow();
  });

  it("allows non-browser calls without Origin or cookies", () => {
    expect(() => assertSameOrigin(request())).not.toThrow();
  });

  it("accepts www origin when NEXT_PUBLIC_WEB_URL is set with www", () => {
    // Behind Railway's proxy, req.nextUrl.origin is the internal host.
    // NEXT_PUBLIC_WEB_URL is the authoritative public origin.
    const orig = process.env.NEXT_PUBLIC_WEB_URL;
    process.env.NEXT_PUBLIC_WEB_URL = "https://www.pulseappointments.com";
    try {
      expect(() => assertSameOrigin(request(
        { origin: "https://www.pulseappointments.com" },
        "https://pulseappointments.com", // internal Railway host
      ))).not.toThrow();
      expect(() => assertSameOrigin(request(
        { origin: "https://evil.example" },
        "https://pulseappointments.com",
      ))).toThrow();
    } finally {
      if (orig === undefined) delete process.env.NEXT_PUBLIC_WEB_URL;
      else process.env.NEXT_PUBLIC_WEB_URL = orig;
    }
  });
});
