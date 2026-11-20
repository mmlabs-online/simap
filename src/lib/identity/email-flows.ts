import type { AuthError } from "./types";

export type CallResult = { ok: true } | { ok: false; error: AuthError };

export type SignUpOutcome =
  | { kind: "sent" }
  | { kind: "error"; error: AuthError; field?: "email" | "password"; resetTurnstile: true };

export function signUpOutcome(r: CallResult): SignUpOutcome {
  if (r.ok) return { kind: "sent" };
  const { error } = r;
  const field =
    error.code === "email_taken"
      ? "email"
      : error.code === "weak_password"
        ? "password"
        : undefined;
  return field
    ? { kind: "error", error, field, resetTurnstile: true }
    : { kind: "error", error, resetTurnstile: true };
}

export type ForgotOutcome =
  | { kind: "sent" }
  | { kind: "error"; error: AuthError; field?: "email"; resetTurnstile: true };

/** Never shows an account-dependent message: any code outside the listed ones becomes `unknown`. */
export function forgotOutcome(r: CallResult): ForgotOutcome {
  if (r.ok) return { kind: "sent" };
  const { error } = r;
  switch (error.code) {
    case "turnstile_failed":
    case "turnstile_required":
    case "rate_limited":
      return { kind: "error", error, resetTurnstile: true };
    case "validation_error":
      return { kind: "error", error, field: "email", resetTurnstile: true };
    default:
      return { kind: "error", error: { code: "unknown" }, resetTurnstile: true };
  }
}

export type VerifyOutcome =
  | { kind: "verified" | "invalid"; clearToken: true }
  | { kind: "ready"; error: AuthError; clearToken: false };

export function verifyOutcome(r: CallResult): VerifyOutcome {
  if (r.ok) return { kind: "verified", clearToken: true };
  const { code } = r.error;
  if (code === "token_invalid" || code === "validation_error") {
    return { kind: "invalid", clearToken: true };
  }
  return { kind: "ready", error: r.error, clearToken: false };
}

export type ResetOutcome =
  | { kind: "done" | "invalid"; clearToken: true }
  | { kind: "ready"; error: AuthError; clearToken: false };

/** `weak_password` keeps the token: the link is still usable. */
export function resetOutcome(r: CallResult): ResetOutcome {
  if (r.ok) return { kind: "done", clearToken: true };
  const { code } = r.error;
  if (code === "token_invalid" || code === "validation_error") {
    return { kind: "invalid", clearToken: true };
  }
  return { kind: "ready", error: r.error, clearToken: false };
}

export type ResendOutcome =
  | { kind: "sent" }
  | { kind: "recheck" }
  | { kind: "signIn"; error: AuthError }
  | { kind: "error"; error: AuthError };

export function resendOutcome(r: CallResult): ResendOutcome {
  if (r.ok) return { kind: "sent" };
  switch (r.error.code) {
    case "email_already_verified":
      return { kind: "recheck" };
    case "session_invalid":
      return { kind: "signIn", error: r.error };
    default:
      return { kind: "error", error: r.error };
  }
}
