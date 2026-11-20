import "server-only";

const CONSTRAINTS = ["rooms_org_code_key", "seats_org_code_key"];

/** Maps a unique violation on a room or seat code to the API code; anything else is not a domain refusal. */
export function roomConflict(err: unknown): "room_code_taken" | null {
  const e = err as { code?: unknown; constraint?: unknown } | null;
  return e?.code === "23505" &&
    typeof e.constraint === "string" &&
    CONSTRAINTS.includes(e.constraint)
    ? "room_code_taken"
    : null;
}
