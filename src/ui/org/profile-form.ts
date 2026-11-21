import { ApiAccessError } from "@/lib/api/fetch";
import { readMeResult } from "@/lib/identity/flow";
import { normalizeDisplayName } from "@/lib/validate/member";

export type ProfileNameCheck =
  | { ok: true; value: string }
  | { ok: false; error: "required" | "invalid" };

/** Client-side check of the typed name; the server repeats it. Blank is "required", anything else refused is "invalid". */
export function validateProfileName(raw: string): ProfileNameCheck {
  if (raw.trim() === "") return { ok: false, error: "required" };
  const value = normalizeDisplayName(raw);
  return value === null ? { ok: false, error: "invalid" } : { ok: true, value };
}

/** `PATCH /api/me` request init; `name` must already be validated. */
export const profilePatchInit = (name: string): RequestInit => ({
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ displayName: name }),
});

export type PatchOutcome =
  | { kind: "saved"; res: Response }
  | { kind: "invalid" }
  | { kind: "retry" }
  | { kind: "access"; error: unknown };

/** Sorts the result of the PATCH call (a response, or what `apiFetch` threw). */
export async function mapPatchResult(
  r: { res: Response } | { error: unknown },
): Promise<PatchOutcome> {
  if ("error" in r) {
    return r.error instanceof ApiAccessError
      ? { kind: "access", error: r.error }
      : { kind: "retry" };
  }
  if (r.res.status === 400) return { kind: "invalid" };
  if (r.res.status !== 200) return { kind: "retry" };
  const read = await readMeResult(r.res.clone());
  const me = read.network ? undefined : read.me;
  return me?.member?.needsProfile === false ? { kind: "saved", res: r.res } : { kind: "retry" };
}
