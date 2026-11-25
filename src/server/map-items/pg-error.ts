import "server-only";

export type MapItemConflictCode = "item_name_taken";

/** DB backstop: a second item whose name has the same key in the org. Anything else is not a domain refusal. */
export function mapItemConflict(err: unknown): MapItemConflictCode | null {
  const e = err as { code?: unknown; constraint?: unknown } | null;
  if (e?.code === "23505" && e.constraint === "map_items_org_name_key") return "item_name_taken";
  return null;
}
