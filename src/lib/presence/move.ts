import type { MyPresenceDto } from "./types";

export type MoveResult =
  | { ok: true; value: MyPresenceDto | null }
  | { ok: false; code: string; room?: string };

export type MoveOutcome = {
  /** The presence to write into the viewer's own state, when the move worked. */
  apply: { presence: MyPresenceDto | null } | null;
  /** Own presence is stale (409 not_checked_in). */
  refreshMine: boolean;
  /** The layout is stale (422 seat_not_yours). */
  reloadLayout: boolean;
  errorCode: string | null;
};

/** What to do with a move answer. A refusal is never retried (PRE-03). */
export function moveOutcome(result: MoveResult): MoveOutcome {
  const none = { apply: null, refreshMine: false, reloadLayout: false, errorCode: null };
  if (result.ok) return { ...none, apply: { presence: result.value } };
  if (result.code === "not_checked_in") {
    return { ...none, refreshMine: true, errorCode: result.code };
  }
  if (result.code === "seat_not_yours") {
    return { ...none, reloadLayout: true, errorCode: result.code };
  }
  return { ...none, errorCode: result.code };
}
