import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MEDIA } from "./breakpoints";

const css = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");

describe("MEDIA", () => {
  it("md/lg/xl equal tokens.css --breakpoint-*", () => {
    for (const key of ["md", "lg", "xl"] as const) {
      const m = new RegExp(`--breakpoint-${key}:\\s*(\\d+)px`).exec(css);
      expect(m, key).not.toBeNull();
      expect(MEDIA[key]).toBe(`(min-width: ${m![1]}px)`);
    }
  });
});
