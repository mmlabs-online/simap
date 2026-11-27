import { pathFromDoor, walkGrid } from "@/lib/sprites/walk-path";
import type { FootprintLookup } from "@/lib/validate/layout";
import { draftToRoomLayout } from "./draft";
import type { Draft } from "./types";

export type DraftWarnings = {
  /** The room has seats but no usable door (none, or every tile beside it is blocked). */
  noDoor: boolean;
  /** Seats whose chair has no path from a door (PRE-07); empty while `noDoor` is set. `code` is null for a new desk. */
  unreachable: { key: string; code: string | null }[];
};

/** Layout warnings for the editor (PRE-07). Informational only: nothing here gates a save. */
export function draftWarnings(draft: Draft, lookup: FootprintLookup): DraftWarnings {
  const out: DraftWarnings = { noDoor: false, unreachable: [] };
  const seats = draft.items.filter((i) => i.kind === "seat");
  if (seats.length === 0) return out;
  const grid = walkGrid(draftToRoomLayout(draft), lookup);
  for (const s of seats) {
    const r = pathFromDoor(grid, s.seatId ?? s.key);
    if (r.ok) continue;
    if (r.reason === "no_door") out.noDoor = true;
    else out.unreachable.push({ key: s.key, code: s.code });
  }
  if (out.noDoor) out.unreachable = [];
  return out;
}
