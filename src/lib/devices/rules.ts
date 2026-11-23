import { atLeast, type Tier } from "@/lib/auth/tier";
import type { DeviceRole } from "./types";

/** D19, D22: the owner, or a Manager+, places, moves and returns a device. */
export const canPlace = (tier: Tier, isOwner: boolean): boolean =>
  isOwner || atLeast(tier, "manager");

/** D19: editing or deleting a device is owner or Admin only. */
export const canEdit = (tier: Tier, isOwner: boolean): boolean => isOwner || tier === "admin";

/** DEV-01: a device is created for oneself; only an Admin creates for another member. */
export const canCreateFor = (tier: Tier, isSelf: boolean): boolean => isSelf || tier === "admin";

export type PlacementRefusalCode =
  | "not_allowed"
  | "placement_changed"
  | "seat_has_no_occupant"
  | "owner_not_occupant"
  | "seat_has_primary";

export type PlacementDecision =
  | { kind: "noop" | "place" | "move" | "return" }
  | { kind: "refuse"; status: 409 | 422; code: PlacementRefusalCode };

export type PlacementInput = {
  tier: Tier;
  isOwner: boolean;
  deviceId: string;
  ownerId: string;
  current: { seatId: string | null; role: DeviceRole };
  expectedSeatId: string | null;
  /** Null returns the device to inventory. */
  target: null | { seatId: string; occupantId: string | null; primaryId: string | null };
  role: DeviceRole;
};

const refuse = (status: 409 | 422, code: PlacementRefusalCode): PlacementDecision => ({
  kind: "refuse",
  status,
  code,
});

/** DEV-03/04/05, REG-03. Permission first (R7 order), then the stale-view guard, then the invariants. */
export function decidePlacement(a: PlacementInput): PlacementDecision {
  if (!canPlace(a.tier, a.isOwner)) return refuse(422, "not_allowed");
  if (a.current.seatId !== a.expectedSeatId) return refuse(409, "placement_changed");
  if (a.target === null) return { kind: a.current.seatId === null ? "noop" : "return" };
  if (a.current.seatId === a.target.seatId && a.current.role === a.role) return { kind: "noop" };
  if (a.role === "primary") {
    if (a.target.occupantId === null) return refuse(409, "seat_has_no_occupant");
    if (a.target.occupantId !== a.ownerId) return refuse(409, "owner_not_occupant");
    if (a.target.primaryId !== null && a.target.primaryId !== a.deviceId) {
      return refuse(409, "seat_has_primary");
    }
  }
  return { kind: a.current.seatId === null ? "place" : "move" };
}
