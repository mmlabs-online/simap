import type { Validated } from "./room";

export const DISPLAY_NAME_MAX = 80;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const clean = (s: string): string => s.normalize("NFC").replace(/\s+/gu, " ").trim();
const length = (s: string): number => [...s].length;
const truncate = (s: string): string => [...s].slice(0, DISPLAY_NAME_MAX).join("").trimEnd();

/** NFC, whitespace runs collapsed, trimmed, 1-80 code points, no control characters. null = invalid. */
export function normalizeDisplayName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = clean(v);
  if (s === "" || /\p{Cc}/u.test(s) || length(s) > DISPLAY_NAME_MAX) return null;
  return s;
}

/** D17: the email local part (before the last `@`); never blank. */
export function defaultDisplayName(email: string): string {
  const at = email.lastIndexOf("@");
  const local = truncate(clean(at > 0 ? email.slice(0, at) : email));
  const fromLocal = normalizeDisplayName(local);
  if (fromLocal !== null) return fromLocal;
  const whole = truncate(clean(email).replace(/\p{Cc}/gu, ""));
  return whole === "" ? "member" : whole;
}

export function validateMePatch(body: unknown): Validated<{ displayName: string }> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = Object.keys(body).find((k) => k !== "displayName");
  if (extra !== undefined) return { ok: false, field: extra };
  const displayName = normalizeDisplayName(body.displayName);
  if (displayName === null) return { ok: false, field: "displayName" };
  return { ok: true, value: { displayName } };
}
