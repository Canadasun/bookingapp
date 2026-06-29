import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("dashboard responsive contracts", () => {
  it("keeps the drawer shell through iPad widths", () => {
    const layout = source("src/app/(en)/dashboard/layout.tsx");
    expect(layout).toContain("lg:translate-x-0");
    expect(layout).toContain("lg:ml-60");
    expect(layout).toContain("lg:hidden");
    expect(layout).not.toContain("md:ml-60");
  });

  it("prevents Safari form zoom on touch-width screens", () => {
    const css = source("src/app/globals.css");
    expect(css).toContain("@media (max-width: 1023px)");
    expect(css).toMatch(/input,\s*select,\s*textarea\s*\{\s*font-size: 16px !important;/s);
  });

  it("uses dynamic viewport height for the message workspace", () => {
    const messages = source("src/app/(en)/dashboard/messages/page.tsx");
    const css = source("src/app/globals.css");
    expect(messages).toContain("dashboard-dynamic-height");
    expect(css).toContain("100dvh");
  });

  it("keeps seven-column appointment calendars readable by scrolling", () => {
    const appointments = source("src/app/(en)/dashboard/appointments/page.tsx");
    expect(appointments).toContain("min-w-[700px] grid-cols-7");
    expect(appointments).toContain("min-w-[760px]");
    expect(appointments).toContain("overflow-x-auto");
  });

  it("keeps settings in compact navigation until wide desktop", () => {
    const settings = source("src/app/(en)/dashboard/settings/page.tsx");
    expect(settings).toContain("xl:hidden");
    expect(settings).toContain("hidden xl:block");
    expect(settings).toContain("xl:flex-row");
  });
});
