import { describe, expect, it } from "vitest";
import { parseCalendarDay, todayUtc7 } from "./holding";

describe("todayUtc7", () => {
  it("rolls over at 17:00 UTC", () => {
    expect(todayUtc7(new Date("2026-11-25T16:59:59.999Z"))).toBe("2026-11-25");
    expect(todayUtc7(new Date("2026-11-25T17:00:00Z"))).toBe("2026-11-26");
    expect(todayUtc7(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01-01");
  });
});

describe("parseCalendarDay", () => {
  it("accepts real dates", () => {
    expect(parseCalendarDay("2028-02-29")).toBe("2028-02-29");
    expect(parseCalendarDay("2026-11-25")).toBe("2026-11-25");
  });
  it("refuses everything else", () => {
    for (const bad of [
      "2026-02-30",
      "2026-13-01",
      "2026-1-5",
      "1999-12-31",
      "2101-01-01",
      "2026-11-25T00:00",
      "",
      null,
      undefined,
      20261125,
    ]) {
      expect(parseCalendarDay(bad)).toBeNull();
    }
  });
});
