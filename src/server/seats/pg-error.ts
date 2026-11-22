import "server-only";

/** The devices FK backstop: a device appeared on a seat that was being deleted. Anything else is not a domain refusal. */
export function seatConflict(err: unknown): "seat_not_empty" | null {
  const e = err as { code?: unknown; constraint?: unknown } | null;
  return e?.code === "23503" && e.constraint === "devices_seat_fkey" ? "seat_not_empty" : null;
}
