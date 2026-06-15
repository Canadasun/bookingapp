import { beforeEach, describe, expect, it } from "vitest";
import { consumeFragmentToken } from "@/lib/fragment-token";

describe("consumeFragmentToken", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/appointments/apt-1/manage");
  });

  it("moves a fragment token into scoped session storage and scrubs the URL", () => {
    window.history.replaceState(null, "", "/appointments/apt-1/manage#token=signed-token");

    expect(consumeFragmentToken("appointment-manage:apt-1")).toBe("signed-token");
    expect(window.location.hash).toBe("");
    expect(window.sessionStorage.getItem("appointment-manage:apt-1")).toBe("signed-token");
  });

  it("returns the stored token on a second effect run or same-tab reload", () => {
    window.sessionStorage.setItem("appointment-manage:apt-1", "stored-token");

    expect(consumeFragmentToken("appointment-manage:apt-1")).toBe("stored-token");
  });

  it("does not expose a token stored for another appointment", () => {
    window.sessionStorage.setItem("appointment-manage:apt-2", "other-token");

    expect(consumeFragmentToken("appointment-manage:apt-1")).toBeUndefined();
  });
});
