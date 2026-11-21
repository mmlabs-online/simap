import { ApiAccessError, type ApiFetch } from "@/lib/api/fetch";
import type { AuthError } from "./types";
import { readMeResult, viewForMe, type MeResult } from "./flow";
import type { Tier } from "@/lib/tier";

/** What the dev-token gate shows (SIM-028.1). No Identity screen exists in this mode. */
export type DevView =
  | { kind: "ready"; tier: Tier; email: string }
  | { kind: "profile"; tier: Tier; email: string; displayName: string }
  | { kind: "token"; reason: "invalid" | "needOrg" }
  | { kind: "noAccess"; code: "forbidden" | "member_deactivated" }
  | { kind: "retry"; error: AuthError };

/** `viewForMe` for dev mode: a missing session is an invalid token, a missing org is the `--org` hint. */
export function devViewForMe(result: MeResult): DevView {
  const v = viewForMe(result);
  if (v.kind === "signedOut") return { kind: "token", reason: "invalid" };
  if (v.kind === "needOrg") return { kind: "token", reason: "needOrg" };
  return v;
}

/** Maps what the dev `apiFetch` throws. Never returns a sign-in, join or org view. */
export function devMeErrorView(err: unknown): DevView {
  if (err instanceof ApiAccessError) {
    if (err.code === "signed_out" || err.code === "unauthenticated")
      return { kind: "token", reason: "invalid" };
    if (err.code === "org_required") return { kind: "token", reason: "needOrg" };
    return { kind: "noAccess", code: err.code };
  }
  return { kind: "retry", error: { code: "network" } };
}

/** `GET /api/me` as a `DevView`; never rejects. */
export async function loadDevView(apiFetch: ApiFetch): Promise<DevView> {
  try {
    return devViewForMe(await readMeResult(await apiFetch("/api/me")));
  } catch (e) {
    return devMeErrorView(e);
  }
}

/** Shares one run between callers until it settles (React StrictMode runs effects twice). */
export function createSingleFlight<T>(run: () => Promise<T>) {
  let current: Promise<T> | null = null;
  return {
    join(): Promise<T> {
      if (current) return current;
      const p: Promise<T> = run().finally(() => {
        if (current === p) current = null;
      });
      current = p;
      return p;
    },
    reset() {
      current = null;
    },
  };
}
