import { describe, expect, it } from "vitest";
import { dayRangeToInstants } from "./day-range";

describe("dayRangeToInstants", () => {
  it("from day starts at 00:00 UTC+7 (2026-03-05 -> 2026-03-04T17:00:00.000Z)", () => {
    expect(dayRangeToInstants("2026-03-05")).toEqual({ from: "2026-03-04T17:00:00.000Z" });
  });
  it("to day is exclusive: the start of the next day in UTC+7 (2026-03-05 -> 2026-03-05T17:00:00.000Z)", () => {
    expect(dayRangeToInstants(undefined, "2026-03-05")).toEqual({ to: "2026-03-05T17:00:00.000Z" });
  });
  it("month and year rollover and leap day", () => {
    expect(dayRangeToInstants(undefined, "2026-12-31")).toEqual({ to: "2026-12-31T17:00:00.000Z" });
    expect(dayRangeToInstants("2026-03-01")).toEqual({ from: "2026-02-28T17:00:00.000Z" });
    expect(dayRangeToInstants(undefined, "2028-02-29")).toEqual({ to: "2028-02-29T17:00:00.000Z" });
  });
  it("absent or empty day -> key omitted", () => {
    expect(dayRangeToInstants()).toEqual({});
    expect(dayRangeToInstants("", "")).toEqual({});
  });
  it("invalid day ('2026-02-30', 'abc', '2026-3-5') -> null", () => {
    for (const bad of ["2026-02-30", "abc", "2026-3-5"]) {
      expect(dayRangeToInstants(bad)).toBeNull();
      expect(dayRangeToInstants(undefined, bad)).toBeNull();
    }
  });
  it("from later than to -> null (so the API is never sent from >= to)", () => {
    expect(dayRangeToInstants("2026-03-06", "2026-03-05")).toBeNull();
    expect(dayRangeToInstants("2026-03-05", "2026-03-05")).toEqual({
      from: "2026-03-04T17:00:00.000Z",
      to: "2026-03-05T17:00:00.000Z",
    });
  });
});
