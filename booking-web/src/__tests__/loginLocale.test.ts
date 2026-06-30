import { describe, expect, it } from "vitest";
import { encodeState, parseStateIntent, parseStateLocale } from "@/lib/sso-cookies";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("login locale handoff", () => {
  it("round-trips locale through OAuth state without changing intent", () => {
    const state = encodeState("client", "fr");
    expect(parseStateIntent(state)).toBe("client");
    expect(parseStateLocale(state)).toBe("fr");
    expect(parseStateLocale(encodeState("owner", "en"))).toBe("en");
  });

  it("persists password and 2FA login locale before dashboard navigation", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "app", "(en)", "login", "page.tsx"),
      "utf8",
    );
    expect(source).toContain('localStorage.setItem("pulse_dashboard_locale", locale)');
    expect(source).toContain("await api.users.updateMe({ locale })");
    expect(source.match(/await finishLogin\(\)/g)).toHaveLength(2);
    expect(source).toContain('/api/auth/google${fr ? "?lang=fr" : ""}');
    expect(source).toContain('/api/auth/apple${fr ? "?lang=fr" : ""}');
  });
});
