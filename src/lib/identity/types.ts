// Mirrors the error codes of org-admin-api (auth/errors.py, core/errors.py, consumers.md).
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_unverified"
  | "not_member"
  | "join_closed"
  | "join_rejected"
  | "join_queue_full"
  | "join_unavailable"
  | "session_invalid"
  | "turnstile_required"
  | "turnstile_failed"
  | "rate_limited"
  | "network"
  | "email_taken"
  | "weak_password"
  | "validation_error"
  | "token_invalid"
  | "email_already_verified"
  | "org_access_denied"
  | "org_invite_forbidden"
  | "invite_role_forbidden"
  | "invitation_limit_reached"
  | "org_invite_unavailable"
  | "invitation_email_mismatch"
  | "unknown_role"
  /** Client-only: a fresh token still got 401. Never accepted from a server body. */
  | "no_access"
  | "unknown";

export type AuthError = {
  code: AuthErrorCode;
  /** rate_limited: Retry-After header / details.retry_after. */
  retryAfterSeconds?: number;
  /** weak_password: details.reasons. */
  reasons?: ("too_short" | "too_common")[];
  /** not_member: details.join_available === true (the user may join the app). */
  joinAvailable?: boolean;
  /** org_access_denied: the org the denied mint named. Set by the client, never read from a server body. */
  orgId?: string;
};

/** Email is trimmed; the password is exactly as typed. */
export type Credentials = { email: string; password: string };

/** An account already signed in on this browser (`GET /accounts`). */
export type AccountChoice = { accountId: string; email: string };

/** An organization the account may enter for this app (`GET /auth/orgs`). */
export type OrgChoice = { id: string; name: string };
