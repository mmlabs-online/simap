import { describe, expect, it } from "vitest";
import { canDeleteDirectly } from "./delete-impact";

const zero = { seats: 0, occupiedSeats: 0, placedDevices: 0, pendingRequests: 0 };

describe("canDeleteDirectly", () => {
  it("all zero -> direct", () => {
    expect(canDeleteDirectly(zero)).toBe(true);
  });

  it("occupied seats or placed devices need force", () => {
    expect(canDeleteDirectly({ ...zero, seats: 2, occupiedSeats: 1 })).toBe(false);
    expect(canDeleteDirectly({ ...zero, seats: 2, placedDevices: 1 })).toBe(false);
  });

  it("unoccupied seats and pending requests only -> direct (Q4)", () => {
    expect(canDeleteDirectly({ ...zero, seats: 5, pendingRequests: 3 })).toBe(true);
  });
});
