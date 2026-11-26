import { atLeast, type Tier } from "@/lib/auth/tier";
import type { DeviceRole } from "./types";

/** D19, D22: the owner, or a Manager+, places, moves and returns a device. */
export const canPlace = (tier: Tier, isOwner: boolean): boolean =>
  isOwner || atLeast(tier, "manager");

/** D19: editing or deleting a device is owner or Admin only. */
export const canEdit = (tier: Tier, isOwner: boolean): boolean => isOwner || tier === "admin";

/** DEV-07: an Admin or Manager assigns an org-inventory device to a member. */
export const canAssign = (tier: Tier): boolean => atLeast(tier, "manager");

/** DEV-07: an Admin or Manager edits an assignment's note and expiry (not the owner). */
export const canManageHolding = (tier: Tier): boolean => atLeast(tier, "manager");

/** DEV-01, OQ-41: only an Admin creates a device; it starts in the org inventory (no owner). */
export const canCreate = (tier: Tier): boolean => tier === "admin";

export type DeleteRefusalCode =
  | "not_allowed"
  | "device_owned"
  | "device_placed"
  | "handoff_pending";

export type DeleteDecision =
  | { kind: "ok" }
  | { kind: "refuse"; status: 409 | 422; code: DeleteRefusalCode };

/** DEV-01, D31: only an Admin deletes, and only an unowned, unplaced device with no pending handoff. */
export function decideDelete(a: {
  tier: Tier;
  ownerId: string | null;
  seatId: string | null;
  pendingHandoff: boolean;
}): DeleteDecision {
  if (a.tier !== "admin") return { kind: "refuse", status: 422, code: "not_allowed" };
  if (a.ownerId !== null) return { kind: "refuse", status: 409, code: "device_owned" };
  if (a.seatId !== null) return { kind: "refuse", status: 409, code: "device_placed" };
  if (a.pendingHandoff) return { kind: "refuse", status: 409, code: "handoff_pending" };
  return { kind: "ok" };
}

export type PlacementRefusalCode =
  | "not_allowed"
  | "device_unowned"
  | "placement_changed"
  | "seat_has_no_occupant"
  | "owner_not_occupant"
  | "seat_has_primary"
  | "seat_not_yours";

export type PlacementDecision =
  | { kind: "noop" | "place" | "move" | "return" }
  | { kind: "refuse"; status: 409 | 422; code: PlacementRefusalCode };

export type PlacementInput = {
  tier: Tier;
  isOwner: boolean;
  /** The caller's member id (null when the caller has no member row). D72 compares it with the seat occupant. */
  callerId: string | null;
  deviceId: string;
  /** Null = org inventory (D63). Callers compute isOwner as `ownerId !== null && me === ownerId`. */
  ownerId: string | null;
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

/** DEV-03/04/05, REG-03, D72: a User places only on a seat they occupy. Permission first (R7 order), then the stale-view guard, then the invariants. */
export function decidePlacement(a: PlacementInput): PlacementDecision {
  if (!canPlace(a.tier, a.isOwner)) return refuse(422, "not_allowed");
  if (a.current.seatId !== a.expectedSeatId) return refuse(409, "placement_changed");
  if (a.target === null) return { kind: a.current.seatId === null ? "noop" : "return" };
  if (a.ownerId === null) return refuse(422, "device_unowned"); // invariant 5
  if (a.current.seatId === a.target.seatId && a.current.role === a.role) return { kind: "noop" };
  if (a.tier === "user" && (a.target.occupantId === null || a.target.occupantId !== a.callerId)) {
    return refuse(422, "seat_not_yours");
  }
  if (a.role === "primary") {
    if (a.target.occupantId === null) return refuse(409, "seat_has_no_occupant");
    if (a.target.occupantId !== a.ownerId) return refuse(409, "owner_not_occupant");
    if (a.target.primaryId !== null && a.target.primaryId !== a.deviceId) {
      return refuse(409, "seat_has_primary");
    }
  }
  return { kind: a.current.seatId === null ? "place" : "move" };
}
