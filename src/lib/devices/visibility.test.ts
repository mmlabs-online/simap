import { describe, expect, it } from "vitest";
import { deviceVisibility, hiddenFromActor, hiddenHandoffFromActor } from "./visibility";

describe("deviceVisibility", () => {
  it("user is held; manager and admin are org", () => {
    expect(deviceVisibility("user")).toBe("held");
    expect(deviceVisibility("manager")).toBe("org");
    expect(deviceVisibility("admin")).toBe("org");
  });
});

describe("hiddenFromActor", () => {
  it("hides a device from a user unless they own it", () => {
    expect(hiddenFromActor("user", "m1", "m1")).toBe(false);
    expect(hiddenFromActor("user", "m2", "m1")).toBe(true);
    expect(hiddenFromActor("user", null, "m1")).toBe(true);
    expect(hiddenFromActor("user", "m1", null)).toBe(true);
    expect(hiddenFromActor("user", null, null)).toBe(true);
  });

  it("never hides from a manager or admin", () => {
    for (const tier of ["manager", "admin"] as const) {
      expect(hiddenFromActor(tier, "m2", "m1")).toBe(false);
      expect(hiddenFromActor(tier, null, null)).toBe(false);
    }
  });
});

describe("hiddenHandoffFromActor", () => {
  it("shows a handoff to its sender and recipient only", () => {
    expect(hiddenHandoffFromActor("user", "m1", "m1", "m2")).toBe(false);
    expect(hiddenHandoffFromActor("user", "m2", "m1", "m2")).toBe(false);
    expect(hiddenHandoffFromActor("user", "m3", "m1", "m2")).toBe(true);
    expect(hiddenHandoffFromActor("user", "m3", "m1", null)).toBe(true);
    expect(hiddenHandoffFromActor("user", null, "m1", null)).toBe(true);
  });

  it("never hides from a manager or admin", () => {
    for (const tier of ["manager", "admin"] as const) {
      expect(hiddenHandoffFromActor(tier, "m3", "m1", "m2")).toBe(false);
      expect(hiddenHandoffFromActor(tier, null, "m1", null)).toBe(false);
    }
  });
});
