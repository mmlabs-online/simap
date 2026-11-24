import { describe, expect, it } from "vitest";
import type { DeactivationImpact } from "@/lib/members/types";
import { apiErrorMessage } from "../copy/api";
import { deactivateErrorAction, deactivateStep, impactLines, releaseFor } from "./deactivate-flow";

const none: DeactivationImpact = {
  occupiedSeats: 0,
  placedDevices: 0,
  primaryDevicesToDemote: 0,
  pendingRequests: 0,
};

describe("deactivate-flow", () => {
  it("deactivateStep is release when seats or placed devices > 0", () => {
    expect(deactivateStep(none)).toBe("plain");
    expect(deactivateStep({ ...none, occupiedSeats: 1 })).toBe("release");
    expect(deactivateStep({ ...none, placedDevices: 2 })).toBe("release");
    expect(deactivateStep({ ...none, pendingRequests: 3 })).toBe("plain");
  });

  it("impactLines lists non-zero counts in order with plurals", () => {
    expect(impactLines(none)).toEqual([]);
    expect(
      impactLines({
        occupiedSeats: 1,
        placedDevices: 2,
        primaryDevicesToDemote: 1,
        pendingRequests: 2,
      }),
    ).toEqual([
      "1 occupied seat",
      "2 placed devices",
      "1 primary device to demote",
      "2 pending requests",
    ]);
    expect(impactLines({ ...none, pendingRequests: 1 })).toEqual(["1 pending request"]);
  });

  it("releaseFor maps the step", () => {
    expect(releaseFor("release")).toBe(true);
    expect(releaseFor("plain")).toBe(false);
  });

  it("deactivateErrorAction", () => {
    expect(deactivateErrorAction("member_not_empty")).toEqual({ kind: "reload-impact" });
    expect(deactivateErrorAction("not_found")).toEqual({ kind: "done" });
    expect(deactivateErrorAction("cannot_deactivate_self")).toEqual({
      kind: "message",
      text: apiErrorMessage("cannot_deactivate_self"),
    });
  });
});
