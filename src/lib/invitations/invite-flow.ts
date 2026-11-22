import type { CallResult } from "@/lib/identity/email-flows";
import type { AuthError } from "@/lib/identity/types";

export type InviteOutcome =
  | { kind: "sent" }
  | { kind: "error"; error: AuthError; field?: "email" | "role" };

/** The Identity invite call: which view state and form field an answer maps to. */
export function inviteOutcome(r: CallResult): InviteOutcome {
  if (r.ok) return { kind: "sent" };
  const { error } = r;
  switch (error.code) {
    case "validation_error":
      return { kind: "error", error, field: "email" };
    case "unknown_role":
    case "invite_role_forbidden":
      return { kind: "error", error, field: "role" };
    default:
      return { kind: "error", error };
  }
}

export type RecordOutcome = { kind: "sent" } | { kind: "sentNotRecorded"; code: string };

/** The simap record call runs after Identity accepted: a failure never reads as "not invited". */
export function recordOutcome(r: { ok: true } | { ok: false; code: string }): RecordOutcome {
  return r.ok ? { kind: "sent" } : { kind: "sentNotRecorded", code: r.code };
}
