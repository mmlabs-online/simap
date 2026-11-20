import type { ApiErrorCode } from "@/lib/api/error";
import { ApiAccessError } from "@/lib/api/fetch";
import { TIERS } from "@/lib/tier";
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
  if (result.status >= 500) return { kind: "retry", error: { code: "unknown" } };
  return { kind: "noAccess", code: "forbidden" };
}

const isAuthError = (e: unknown): e is AuthError =>
  typeof e === "object" && e !== null && typeof (e as AuthError).code === "string";

/**
 * Maps what `apiFetch("/api/me")` throws. An access error from simap goes through `viewForMe`; an `AuthError` from
 * `getToken` through `viewForTokenError`; anything else (network failure, abort) means "try again", never "no access".
 */
export function meErrorView(err: unknown, hasAccount: boolean): GateView | MeView {
  if (err instanceof ApiAccessError) {
    if (err.code === "signed_out") return { kind: "signIn" };
    if (err.code === "unauthenticated") return viewForMe({ status: 401 });
    return viewForMe({ status: 403, code: err.code });
  }
  if (isAuthError(err)) return viewForTokenError(err, hasAccount);
  return viewForMe({ network: true });
}

/** Reads the `/api/me` response into a `MeResult` (never throws; an unreadable body fails closed in `viewForMe`). */
export async function readMeResult(res: Response): Promise<MeResult> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body
  }
  const obj = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const errorCode = (obj.error as { code?: unknown } | null | undefined)?.code;
  const tier = TIERS.find((t) => t === obj.tier);
  const me =
    res.status === 200 && tier && typeof obj.email === "string"
      ? { tier, email: obj.email }
      : undefined;
  return {
    status: res.status,
    code: typeof errorCode === "string" ? errorCode : undefined,
    me,
  };
}
