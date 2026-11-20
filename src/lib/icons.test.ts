import { describe, expect, it } from "vitest";
import { ICON_NAMES, iconFontHref } from "./icons";
import { navItemsFor } from "./nav";

describe("ICON_NAMES", () => {
  it("is sorted, unique and snake_case", () => {
    expect([...ICON_NAMES]).toEqual([...new Set(ICON_NAMES)].sort());
    for (const n of ICON_NAMES) expect(n).toMatch(/^[a-z]+(_[a-z]+)*$/);
  });
  it("covers every nav icon", () => {
    for (const item of navItemsFor("admin")) expect(ICON_NAMES).toContain(item.icon);
  });
});

describe("iconFontHref", () => {
  it("pins the subset and blocks the ligature text while loading", () => {
    const href = iconFontHref();
    expect(href).toContain(`icon_names=${ICON_NAMES.join(",")}`);
    expect(href).toContain("display=block");
  });
});
