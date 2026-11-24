import "server-only";

/** DEV-03 DB backstops: a second primary on a seat, or a primary whose owner is not the occupant. Anything else is not a domain refusal. */
export function deviceConflict(err: unknown): "seat_has_primary" | "owner_not_occupant" | null {
  const e = err as { code?: unknown; constraint?: unknown } | null;
  if (e?.code === "23505" && e.constraint === "devices_one_primary_per_seat") {
    return "seat_has_primary";
  }
  if (e?.code === "23514" && e.constraint === "devices_primary_owner_is_occupant") {
    return "owner_not_occupant";
  }
  return null;
}
