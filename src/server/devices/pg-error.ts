import "server-only";

export type DeviceConflictCode =
  | "seat_has_primary"
  | "owner_not_occupant"
  | "inventory_number_taken"
  | "mac_taken"
  | "serial_taken"
  | "device_unowned";

/** DB backstops: a second primary on a seat, a primary whose owner is not the occupant, a duplicate inventory number, MAC or serial, an unowned device at a seat. Anything else is not a domain refusal. */
export function deviceConflict(err: unknown): DeviceConflictCode | null {
  const e = err as { code?: unknown; constraint?: unknown } | null;
  if (e?.code === "23505" && e.constraint === "devices_org_inventory_number_key") {
    return "inventory_number_taken";
  }
  if (e?.code === "23505" && e.constraint === "devices_org_mac_key") return "mac_taken";
  if (e?.code === "23505" && e.constraint === "devices_org_serial_key") return "serial_taken";
  if (e?.code === "23505" && e.constraint === "devices_one_primary_per_seat") {
    return "seat_has_primary";
  }
  if (e?.code === "23514" && e.constraint === "devices_primary_owner_is_occupant") {
    return "owner_not_occupant";
  }
  if (e?.code === "23514" && e.constraint === "devices_unowned_not_placed_check") {
    return "device_unowned";
  }
  return null;
}
