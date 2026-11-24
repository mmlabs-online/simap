import { GROUP_LIMITS } from "@/lib/groups/types";
import type { Validated } from "./room";
import { isCanonicalUuid } from "./uuid";

export type GroupCreateValue = { name: string; color: string };
export type GroupPatchValue = Partial<GroupCreateValue>;
export type ProjectCreateValue = { code: string; name: string };
export type ProjectPatchValue = Partial<ProjectCreateValue>;
export type SeatTagsValue = { groupId?: string | null; projectId?: string | null };

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const CODE_RE = /^[A-Z0-9._-]+$/;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const unknownKey = (body: Record<string, unknown>, keys: string[]) =>
  Object.keys(body).find((k) => !keys.includes(k));

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const n = v.normalize("NFC").trim();
  return n.length >= 1 && n.length <= max ? n : null;
}

const color = (v: unknown): string | null => (typeof v === "string" && COLOR_RE.test(v) ? v : null);

/** Project codes are uppercase like room codes: trim + toUpperCase first, then validate. */
function code(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return c.length >= 1 && c.length <= GROUP_LIMITS.projectCode && CODE_RE.test(c) ? c : null;
}

export function validateGroupCreate(body: unknown): Validated<GroupCreateValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = unknownKey(body, ["name", "color"]);
  if (extra !== undefined) return { ok: false, field: extra };
  const n = text(body.name, GROUP_LIMITS.name);
  if (n === null) return { ok: false, field: "name" };
  const c = color(body.color);
  if (c === null) return { ok: false, field: "color" };
  return { ok: true, value: { name: n, color: c } };
}

export function validateGroupPatch(body: unknown): Validated<GroupPatchValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = unknownKey(body, ["name", "color"]);
  if (extra !== undefined) return { ok: false, field: extra };
  const value: GroupPatchValue = {};
  if ("name" in body) {
    const n = text(body.name, GROUP_LIMITS.name);
    if (n === null) return { ok: false, field: "name" };
    value.name = n;
  }
  if ("color" in body) {
    const c = color(body.color);
    if (c === null) return { ok: false, field: "color" };
    value.color = c;
  }
  if (Object.keys(value).length === 0) return { ok: false, field: "body" };
  return { ok: true, value };
}

export function validateProjectCreate(body: unknown): Validated<ProjectCreateValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = unknownKey(body, ["code", "name"]);
  if (extra !== undefined) return { ok: false, field: extra };
  const c = code(body.code);
  if (c === null) return { ok: false, field: "code" };
  const n = text(body.name, GROUP_LIMITS.projectName);
  if (n === null) return { ok: false, field: "name" };
  return { ok: true, value: { code: c, name: n } };
}

export function validateProjectPatch(body: unknown): Validated<ProjectPatchValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = unknownKey(body, ["code", "name"]);
  if (extra !== undefined) return { ok: false, field: extra };
  const value: ProjectPatchValue = {};
  if ("code" in body) {
    const c = code(body.code);
    if (c === null) return { ok: false, field: "code" };
    value.code = c;
  }
  if ("name" in body) {
    const n = text(body.name, GROUP_LIMITS.projectName);
    if (n === null) return { ok: false, field: "name" };
    value.name = n;
  }
  if (Object.keys(value).length === 0) return { ok: false, field: "body" };
  return { ok: true, value };
}

const uuidOrNull = (v: unknown): v is string | null => v === null || isCanonicalUuid(v);

export function validateSeatTags(body: unknown): Validated<SeatTagsValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = unknownKey(body, ["groupId", "projectId"]);
  if (extra !== undefined) return { ok: false, field: extra };
  const value: SeatTagsValue = {};
  if ("groupId" in body) {
    if (!uuidOrNull(body.groupId)) return { ok: false, field: "groupId" };
    value.groupId = body.groupId;
  }
  if ("projectId" in body) {
    if (!uuidOrNull(body.projectId)) return { ok: false, field: "projectId" };
    value.projectId = body.projectId;
  }
  if (Object.keys(value).length === 0) return { ok: false, field: "body" };
  return { ok: true, value };
}
