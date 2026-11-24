import type { SeatStatus } from "./types";

/** SEA-02: status is derived from the occupant, never stored. */
export const seatStatus = (occupantId: string | null): SeatStatus =>
  occupantId === null ? "empty" : "occupied";

export type OccupantDecision =
  | "noop"
  | "assign"
  | "replace"
  | "remove"
  | "refuse_changed"
  | "refuse_cannot_seat";

/**
 * SEA-03 / D18: `expected` is the occupant the caller saw; a mismatch means the seat changed under them.
 * Order matters: a no-op wins over everything, clearing is allowed on a cannot-seat seat.
 */
export function decideOccupantChange(a: {
  current: string | null;
  target: string | null;
  expected: string | null;
  cannotSeat: boolean;
}): OccupantDecision {
  if (a.current === a.target) return "noop";
  if (a.target === null) return a.current === a.expected ? "remove" : "refuse_changed";
  if (a.cannotSeat) return "refuse_cannot_seat";
  if (a.current !== a.expected) return "refuse_changed";
  return a.current === null ? "assign" : "replace";
}

/** REG-03: only the occupant releases their own seat. `actorMemberId` is null when the caller has no member row. */
export function decideRelease(a: {
  current: string | null;
  actorMemberId: string | null;
}): "noop" | "release" | "refuse" {
  if (a.current === null) return "noop";
  return a.actorMemberId !== null && a.actorMemberId === a.current ? "release" : "refuse";
}

/** SEA-01: a seat with an occupant or any device is never deleted. */
export function decideDelete(a: {
  occupantId: string | null;
  deviceCount: number;
}): "delete" | "refuse" {
  return a.occupantId !== null || a.deviceCount > 0 ? "refuse" : "delete";
}

/** SEA-04 / D32: only a seat without a group takes the occupant's group. */
export const inheritedGroup = (seatGroupId: string | null, memberGroupId: string | null) =>
  seatGroupId ?? memberGroupId;
