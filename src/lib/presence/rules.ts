export type ActiveRef = { roomId: string; seatId: string };

export type CheckInDecision = "same" | "refuse_other_room" | "refuse_no_seat" | "reopen" | "insert";

/** PRE-03: the one active check-in is decided before any seat check. `todayRowExists` = a row for today's work date. */
export function decideCheckIn(i: {
  active: ActiveRef | null;
  roomId: string;
  todayRowExists: boolean;
  lowestSeatId: string | null;
}): CheckInDecision {
  if (i.active) return i.active.roomId === i.roomId ? "same" : "refuse_other_room";
  if (i.lowestSeatId === null) return "refuse_no_seat";
  return i.todayRowExists ? "reopen" : "insert";
}

export type MoveDecision = "refuse_not_checked_in" | "refuse_not_yours" | "noop" | "move";

/** D77: no active check-in comes first (409), then the target must be the member's own seat in the active room. */
export function decideMove(i: {
  active: ActiveRef | null;
  memberId: string;
  target: { id: string; roomId: string; occupantId: string | null } | null;
}): MoveDecision {
  if (!i.active) return "refuse_not_checked_in";
  const t = i.target;
  if (!t || t.occupantId !== i.memberId || t.roomId !== i.active.roomId) return "refuse_not_yours";
  return t.id === i.active.seatId ? "noop" : "move";
}

export function decideCheckOut(i: { active: ActiveRef | null }): "noop" | "check_out" {
  return i.active ? "check_out" : "noop";
}

/** PRE-05 / D82: mirrors the SQL active rule in `src/server/presence/sql.ts`. */
export function isActive(i: {
  workDate: string;
  today: string;
  checkedOut: boolean;
  seatOccupantId: string | null;
  memberId: string;
}): boolean {
  return i.workDate === i.today && !i.checkedOut && i.seatOccupantId === i.memberId;
}
