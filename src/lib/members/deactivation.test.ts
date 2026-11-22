import { describe, expect, it } from "vitest";
import { decideDeactivation, needsRelease } from "./deactivation";
import type { DeactivationImpact } from "./types";

const impact = (o: Partial<DeactivationImpact> = {}): DeactivationImpact => ({
  occupiedSeats: 0,
  placedDevices: 0,
  primaryDevicesToDemote: 0,
  pendingRequests: 0,
  ...o,
});

describe("needsRelease", () => {
  it("true iff occupiedSeats > 0 or placedDevices > 0 (pendingRequests alone is false)", () => {
    expect(needsRelease(impact())).toBe(false);
    expect(needsRelease(impact({ pendingRequests: 3, primaryDevicesToDemote: 1 }))).toBe(false);
    expect(needsRelease(impact({ occupiedSeats: 1 }))).toBe(true);
    expect(needsRelease(impact({ placedDevices: 1 }))).toBe(true);
  });
});

describe("decideDeactivation", () => {
  const base = { impact: impact(), release: false, isSelf: false, status: "active" as const };
  it("self -> refuse_self, even when already deactivated", () => {
    expect(decideDeactivation({ ...base, isSelf: true })).toBe("refuse_self");
    expect(decideDeactivation({ ...base, isSelf: true, status: "deactivated" })).toBe(
      "refuse_self",
    );
  });
  it("already deactivated -> noop", () => {
    expect(
      decideDeactivation({ ...base, status: "deactivated", impact: impact({ occupiedSeats: 1 }) }),
    ).toBe("noop");
  });
  it("non-empty + release false -> refuse_not_empty", () => {
    expect(decideDeactivation({ ...base, impact: impact({ occupiedSeats: 2 }) })).toBe(
      "refuse_not_empty",
    );
  });
  it("non-empty + release true -> release", () => {
    expect(
      decideDeactivation({ ...base, release: true, impact: impact({ placedDevices: 1 }) }),
    ).toBe("release");
  });
  it("empty -> deactivate, with or without release", () => {
    expect(decideDeactivation(base)).toBe("deactivate");
    expect(decideDeactivation({ ...base, release: true })).toBe("deactivate");
  });
});
