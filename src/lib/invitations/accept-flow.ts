import type { CallResult } from "@/lib/identity/email-flows";
import type { AuthError } from "@/lib/identity/types";

export type AcceptResult = { ok: true; orgId: string | null } | { ok: false; error: AuthError };

export type AcceptOutcome =
  | { kind: "done"; orgId: string | null; clearToken: true }
  | { kind: "invalid"; clearToken: true }
  | { kind: "signIn"; error: AuthError; clearToken: false }
  | { kind: "ready"; error: AuthError; clearToken: false; offerOtherAccount?: true };

/** Anything unlisted keeps the token, so a retry never burns a still-valid link. */
export function acceptOutcome(r: AcceptResult): AcceptOutcome {
  if (r.ok) return { kind: "done", orgId: r.orgId, clearToken: true };
  const { error } = r;
  switch (error.code) {
    case "token_invalid":
    case "validation_error":
      return { kind: "invalid", clearToken: true };
    case "invitation_email_mismatch":
      return { kind: "ready", error, clearToken: false, offerOtherAccount: true };
    case "session_invalid":
      return { kind: "signIn", error, clearToken: false };
    default:
      return { kind: "ready", error, clearToken: false };
  }
}

export type SignInStep =
  | { kind: "continue" }
  | { kind: "signIn"; error: AuthError; needTurnstile?: true };

/** The sign-in on this page only has to reach an account; `not_member` and `email_unverified` are settled by accepting. */
export function signInOutcome(r: CallResult): SignInStep {
  if (r.ok) return { kind: "continue" };
  const { error } = r;
  switch (error.code) {
    case "not_member":
    case "email_unverified":
      return { kind: "continue" };
    case "turnstile_required":
      return { kind: "signIn", error, needTurnstile: true };
    default:
      return { kind: "signIn", error };
  }
}
