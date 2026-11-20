export const ROOM_LIMITS = { code: 32, name: 120, description: 500, floor: 40 } as const;

export type RoomCreateValue = {
  code: string;
  name: string;
  description: string | null;
  floor: string | null;
};
export type RoomPatchValue = Partial<RoomCreateValue>;

export type Validated<T> = { ok: true; value: T } | { ok: false; field: string };

const CODE_RE = /^[A-Z0-9._-]+$/;
const KEYS = ["code", "name", "description", "floor"];

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Q2: codes are uppercase; trim + toUpperCase first, then validate, and the result is what gets stored. */
function code(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toUpperCase();
  return c.length >= 1 && c.length <= ROOM_LIMITS.code && CODE_RE.test(c) ? c : null;
}

function name(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.normalize("NFC").trim();
  return n.length >= 1 && n.length <= ROOM_LIMITS.name ? n : null;
}

/** undefined = invalid; null = cleared (`null` or blank). */
function optionalText(v: unknown, max: number): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.normalize("NFC").trim();
  if (t === "") return null;
  return t.length <= max ? t : undefined;
}

const unknownKey = (body: Record<string, unknown>): string | undefined =>
  Object.keys(body).find((k) => !KEYS.includes(k));

export function validateRoomCreate(body: unknown): Validated<RoomCreateValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = unknownKey(body);
  if (extra !== undefined) return { ok: false, field: extra };
  const c = code(body.code);
  if (c === null) return { ok: false, field: "code" };
  const n = name(body.name);
  if (n === null) return { ok: false, field: "name" };
  const d =
    body.description === undefined ? null : optionalText(body.description, ROOM_LIMITS.description);
  if (d === undefined) return { ok: false, field: "description" };
  const f = body.floor === undefined ? null : optionalText(body.floor, ROOM_LIMITS.floor);
  if (f === undefined) return { ok: false, field: "floor" };
  return { ok: true, value: { code: c, name: n, description: d, floor: f } };
}

export function validateRoomPatch(body: unknown): Validated<RoomPatchValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = unknownKey(body);
  if (extra !== undefined) return { ok: false, field: extra };
  const value: RoomPatchValue = {};
  if ("code" in body) {
    const c = code(body.code);
    if (c === null) return { ok: false, field: "code" };
    value.code = c;
  }
  if ("name" in body) {
    const n = name(body.name);
    if (n === null) return { ok: false, field: "name" };
    value.name = n;
  }
  if ("description" in body) {
    const d = optionalText(body.description, ROOM_LIMITS.description);
    if (d === undefined) return { ok: false, field: "description" };
    value.description = d;
  }
  if ("floor" in body) {
    const f = optionalText(body.floor, ROOM_LIMITS.floor);
    if (f === undefined) return { ok: false, field: "floor" };
    value.floor = f;
  }
  if (Object.keys(value).length === 0) return { ok: false, field: "body" };
  return { ok: true, value };
}
