import { describe, expect, it } from "vitest";
import { deleteStep, impactLines } from "./delete-flow";

const zero = { seats: 0, occupiedSeats: 0, placedDevices: 0, pendingRequests: 0 };

describe("deleteStep", () => {
  it("is plain when nothing is occupied or placed (free seats and requests do not count)", () => {
    expect(deleteStep(zero)).toBe("plain");
    expect(deleteStep({ ...zero, seats: 4, pendingRequests: 2 })).toBe("plain");
  });
  it("is forced when a seat is occupied or a device is placed", () => {
    expect(deleteStep({ ...zero, seats: 4, occupiedSeats: 1 })).toBe("forced");
    expect(deleteStep({ ...zero, placedDevices: 1 })).toBe("forced");
  });
});

describe("impactLines", () => {
  it("lists only non-zero counts in order", () => {
    expect(
      impactLines({ seats: 4, occupiedSeats: 1, placedDevices: 2, pendingRequests: 1 }),
    ).toEqual(["4 seats", "1 occupied seat", "2 placed devices", "1 pending request"]);
    expect(impactLines({ ...zero, placedDevices: 1 })).toEqual(["1 placed device"]);
    expect(impactLines(zero)).toEqual([]);
  });
});
