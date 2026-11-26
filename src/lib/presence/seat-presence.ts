import type { SeatView } from "@/lib/sprites/layout";
import type { RoomPresenceMember } from "./types";

/** An occupied seat in the presence view: its occupant is checked in to the room (present) or not (away). */
export type SeatPresence = "present" | "away";

/**
 * Present or away per seat (PRE-06, LAY-06). Seats without an occupant are absent (unassigned, drawn as today).
 * The occupant id of a seat view is the member id. Presence rows for seats the layout does not have are ignored.
 */
export function seatPresenceMap(
  seatViews: Readonly<Record<string, SeatView>>,
  members: readonly RoomPresenceMember[],
): Record<string, SeatPresence> {
  const here = new Set(members.map((m) => `${m.seatId}|${m.memberId}`));
  const out: Record<string, SeatPresence> = {};
  for (const [id, view] of Object.entries(seatViews)) {
    if (view.avatarSeed === null) continue;
    out[id] = here.has(`${id}|${view.avatarSeed}`) ? "present" : "away";
  }
  return out;
}
