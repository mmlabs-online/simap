import { describe, expect, it } from "vitest";
import { occupancyPercent, ringDash } from "./occupancy";

describe("occupancyPercent", () => {
  it.each([
    [0, 0, 0],
    [0, 10, 0],
    [5, 10, 50],
    [1, 3, 33],
    [2, 3, 67],
    [10, 10, 100],
    [11, 10, 100],
    [3, -2, 0],
  ])("(%i, %i) = %i", (o, t, p) => {
    expect(occupancyPercent(o, t)).toBe(p);
  });
});

describe("ringDash", () => {
  it("empty ring keeps the full offset, full ring none, half is half", () => {
    const empty = ringDash(0, 20);
    expect(empty.offset).toBe(empty.circumference);
    expect(ringDash(100, 20).offset).toBe(0);
    expect(ringDash(50, 20).offset).toBeCloseTo(empty.circumference / 2);
  });
});
