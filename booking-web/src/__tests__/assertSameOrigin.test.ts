import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/same-origin";

function request(headers: Record<string, string> = {}, origin = "http://localhost:3000") {
  return { headers: new Headers(headers), nextUrl: { origin } } as unknown as NextRequest;
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

  it("rejects cookie-authenticated requests with no Origin", () => {
    expect(() => assertSameOrigin(request({ cookie: "booking_refresh=token" }))).toThrow();
  });

  it("allows non-browser calls without Origin or cookies", () => {
    expect(() => assertSameOrigin(request())).not.toThrow();
  });
});
