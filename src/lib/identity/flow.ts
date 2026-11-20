import type { ApiErrorCode } from "@/lib/api/error";
import type { Tier } from "@/lib/tier";
import type { AuthError } from "./types";

/** Which screen the sign-in gate shows next. Decisions only; the gate does the effects. */
export type GateView =
  | { kind: "checking" }
  | { kind: "signIn"; error?: AuthError; relistAccounts?: boolean }
  | { kind: "join"; error?: AuthError }
  | { kind: "unverified" }
  | { kind: "retry"; error: AuthError };

const RETRY_CODES: AuthError["code"][] = ["network", "rate_limited", "unknown"];
const JOIN_ERROR_CODES: AuthError["code"][] = [
  "join_closed",
  "join_rejected",
  "join_queue_full",
  "join_unavailable",
];

/** Where a failed `/token` (or join) call leaves the user. `hasAccount`: an account id is stored on this device. */
export function viewForTokenError(err: AuthError, hasAccount: boolean): GateView {
  if (err.code === "not_member" && err.joinAvailable === true && hasAccount)
    return { kind: "join" };
  if (err.code === "email_unverified" && hasAccount) return { kind: "unverified" };
  if (err.code === "session_invalid") return { kind: "signIn", error: err, relistAccounts: true };
  if (RETRY_CODES.includes(err.code)) return { kind: "retry", error: err };
  if (JOIN_ERROR_CODES.includes(err.code) && hasAccount) return { kind: "join", error: err };
  return { kind: "signIn", error: err };
}

/** Start state: restore from the stored account id, else the sign-in page. */
export const initialView = (hasAccountId: boolean): GateView =>
  hasAccountId ? { kind: "checking" } : { kind: "signIn" };

/** Outcome of `GET /api/me` as the gate sees it. `network`: the request threw. */
export type MeResult =
  | { network: true }
  | {
      network?: false;
      status: number;
      code?: ApiErrorCode | string;
      me?: { tier: Tier; email: string };
    };

export type MeView =
  | { kind: "ready"; tier: Tier; email: string }
  | { kind: "noOrg" }
  | { kind: "noAccess"; code: "forbidden" | "member_deactivated" }
  | { kind: "signedOut"; error: AuthError }
  | { kind: "retry"; error: AuthError };

/** Maps the `/api/me` answer to a gate state. Anything unexpected fails closed (no access). */
export function viewForMe(result: MeResult): MeView {
  if (result.network) return { kind: "retry", error: { code: "network" } };
  if (result.status === 200 && result.me) {
    return { kind: "ready", tier: result.me.tier, email: result.me.email };
  }
  if (result.status === 401) return { kind: "signedOut", error: { code: "no_access" } };
  if (result.status === 403) {
    if (result.code === "org_required") return { kind: "noOrg" };
    if (result.code === "member_deactivated")
      return { kind: "noAccess", code: "member_deactivated" };
    return { kind: "noAccess", code: "forbidden" };
  }
  if (result.status === 503) return { kind: "retry", error: { code: "unknown" } };
  return { kind: "noAccess", code: "forbidden" };
}
