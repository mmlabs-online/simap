import type { Validated } from "./room";
import { isCanonicalUuid } from "./uuid";

export const DISPLAY_NAME_MAX = 80;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const clean = (s: string): string => s.normalize("NFC").replace(/\s+/gu, " ").trim();
const length = (s: string): number => [...s].length;
const truncate = (s: string): string => [...s].slice(0, DISPLAY_NAME_MAX).join("").trimEnd();

const INVISIBLE_SRC = String.raw`[\p{Cc}\p{Cf}ᅟᅠㅤﾠ]`;
const INVISIBLE = new RegExp(INVISIBLE_SRC, "u");
const INVISIBLE_G = new RegExp(INVISIBLE_SRC, "gu");
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

/**
 * NFC, whitespace runs collapsed, trimmed, 1-80 code points. Rejects control, format (incl. ZWJ/ZWNJ, bidi
 * overrides) and filler characters, and names without a letter, number, symbol or punctuation. null = invalid.
 */
export function normalizeDisplayName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = clean(v);
  if (!VISIBLE.test(s) || INVISIBLE.test(s) || length(s) > DISPLAY_NAME_MAX) return null;
  return s;
}

/** D17: the email local part (before the last `@`); never blank. */
export function defaultDisplayName(email: string): string {
  const at = email.lastIndexOf("@");
  const local = truncate(clean((at > 0 ? email.slice(0, at) : email).replace(INVISIBLE_G, "")));
  const fromLocal = normalizeDisplayName(local);
  if (fromLocal !== null) return fromLocal;
  const whole = truncate(clean(email.replace(INVISIBLE_G, "")));
  return VISIBLE.test(whole) ? whole : "member";
}

export function validateMePatch(body: unknown): Validated<{ displayName: string }> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = Object.keys(body).find((k) => k !== "displayName");
  if (extra !== undefined) return { ok: false, field: extra };
  const displayName = normalizeDisplayName(body.displayName);
  if (displayName === null) return { ok: false, field: "displayName" };
  return { ok: true, value: { displayName } };
}

export const EMPLOYEE_CODE_MAX = 32;
const EMPLOYEE_CODE_RE = /^[A-Za-z0-9._-]+$/;

/** Trim, then 1-32 of A-Z a-z 0-9 . _ - (ASCII only), stored uppercase so `e1` and `E1` are one code. null = invalid. */
export function normalizeEmployeeCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < 1 || t.length > EMPLOYEE_CODE_MAX || !EMPLOYEE_CODE_RE.test(t)) return null;
  return t.toUpperCase();
}

export type MemberPatchValue = {
  displayName?: string;
  employeeCode?: string | null;
  groupId?: string | null;
};

const PATCH_KEYS = ["displayName", "employeeCode", "groupId"];

export function validateMemberPatch(body: unknown): Validated<MemberPatchValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = Object.keys(body).find((k) => !PATCH_KEYS.includes(k));
  if (extra !== undefined) return { ok: false, field: extra };
  const value: MemberPatchValue = {};
  if ("displayName" in body) {
    const n = normalizeDisplayName(body.displayName);
    if (n === null) return { ok: false, field: "displayName" };
    value.displayName = n;
  }
  if ("employeeCode" in body) {
    const raw = body.employeeCode;
    if (raw === null || (typeof raw === "string" && raw.trim() === "")) {
      value.employeeCode = null;
    } else {
      const c = normalizeEmployeeCode(raw);
      if (c === null) return { ok: false, field: "employeeCode" };
      value.employeeCode = c;
    }
  }
  if ("groupId" in body) {
    const g = body.groupId;
    if (g !== null && !isCanonicalUuid(g)) return { ok: false, field: "groupId" };
    value.groupId = g;
  }
  if (Object.keys(value).length === 0) return { ok: false, field: "body" };
  return { ok: true, value };
}

export function validateDeactivateBody(body: unknown): Validated<{ release: boolean }> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = Object.keys(body).find((k) => k !== "release");
  if (extra !== undefined) return { ok: false, field: extra };
  if (typeof body.release !== "boolean") return { ok: false, field: "release" };
  return { ok: true, value: { release: body.release } };
}
