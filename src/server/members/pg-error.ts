import "server-only";

/** Maps a unique/foreign-key violation on a member field to a domain code; anything else is not a refusal. */
export function memberConflict(err: unknown): "employee_code_taken" | "invalid_group" | null {
  const e = err as { code?: unknown; constraint?: unknown } | null;
  if (e?.code === "23505" && e.constraint === "members_org_employee_code_key") {
    return "employee_code_taken";
  }
  if (e?.code === "23503" && e.constraint === "members_group_fkey") return "invalid_group";
  return null;
}
