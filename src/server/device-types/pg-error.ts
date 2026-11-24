import "server-only";

export type DeviceTypeConflictCode = "name_taken";

/** DB backstop: a second type whose name has the same key in the org. Anything else is not a domain refusal. */
export function deviceTypeConflict(err: unknown): DeviceTypeConflictCode | null {
  const e = err as { code?: unknown; constraint?: unknown } | null;
  if (e?.code === "23505" && e.constraint === "device_types_org_name_key") return "name_taken";
  return null;
}
