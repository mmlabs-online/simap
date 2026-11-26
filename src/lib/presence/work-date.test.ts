import { describe, expect, it } from "vitest";
import { workDateUtc7 } from "./work-date";

describe("workDateUtc7", () => {
  it.each([
    ["2026-11-26T16:59:59.999Z", "2026-11-26"],
    ["2026-11-26T17:00:00.000Z", "2026-11-27"],
    ["2026-11-30T17:00:00.000Z", "2026-12-01"],
    ["2026-12-31T17:00:00.000Z", "2027-01-01"],
    ["2028-02-28T17:00:00.000Z", "2028-02-29"],
  ])("%s -> %s", (iso, day) => {
    expect(workDateUtc7(new Date(iso))).toBe(day);
  });

  it("throws on an invalid Date", () => {
    expect(() => workDateUtc7(new Date("nope"))).toThrow();
  });
});
