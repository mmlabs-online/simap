import "server-only";

const CONSTRAINTS: Record<string, "group_name_taken" | "project_code_taken"> = {
  groups_org_name_key: "group_name_taken",
  projects_org_code_key: "project_code_taken",
};

/** Maps a unique violation on a group name or project code to the API code; anything else is not a domain refusal. */
export function groupConflict(err: unknown): "group_name_taken" | "project_code_taken" | null {
  const e = err as { code?: unknown; constraint?: unknown } | null;
  if (e?.code !== "23505" || typeof e.constraint !== "string") return null;
  return Object.hasOwn(CONSTRAINTS, e.constraint) ? CONSTRAINTS[e.constraint]! : null;
}
