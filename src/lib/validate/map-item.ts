import {
  MAP_ITEM_DIRS,
  MAP_ITEM_LIMITS,
  type MapItemArtValue,
  type MapItemPatchValue,
} from "@/lib/map-items/types";
import { isFrameKey } from "@/lib/sprites/registry";
import type { Direction } from "@/lib/sprites/types";
import type { Validated } from "./room";

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;
const KEY = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
export const SPRITE_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/;

/** A `builtinKey` path segment (same rule as the DB check). */
export const isMapItemKey = (s: string): boolean => s.length <= 100 && KEY.test(s);

export const artDir = (s: string): Direction | null =>
  (MAP_ITEM_DIRS as readonly string[]).includes(s) ? (s as Direction) : null;

/** NFC, Unicode whitespace runs collapsed to one space, trimmed, 1..max code points, no control or format characters. */
function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (s === "" || CONTROL_OR_FORMAT.test(s) || [...s].length > max) return null;
  return s;
}

const size = (v: unknown): number | null =>
  typeof v === "number" &&
  Number.isInteger(v) &&
  v >= MAP_ITEM_LIMITS.sizeMin &&
  v <= MAP_ITEM_LIMITS.sizeMax
    ? v
    : null;

/** A non-empty partial of name, group, hidden, w, h. No ordering key (D67 1). */
export function validateMapItemPatch(body: unknown): Validated<MapItemPatchValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const keys = Object.keys(body);
  const extra = keys.find((k) => !["name", "group", "hidden", "w", "h"].includes(k));
  if (extra !== undefined) return { ok: false, field: extra };
  if (keys.length === 0) return { ok: false, field: "body" };
  const value: MapItemPatchValue = {};
  if ("name" in body) {
    const n = text(body.name, MAP_ITEM_LIMITS.name);
    if (n === null) return { ok: false, field: "name" };
    value.name = n;
  }
  if ("group" in body) {
    const g = text(body.group, MAP_ITEM_LIMITS.group);
    if (g === null) return { ok: false, field: "group" };
    value.group = g;
  }
  if ("hidden" in body) {
    if (typeof body.hidden !== "boolean") return { ok: false, field: "hidden" };
    value.hidden = body.hidden;
  }
  for (const k of ["w", "h"] as const) {
    if (!(k in body)) continue;
    const n = size(body[k]);
    if (n === null) return { ok: false, field: k };
    value[k] = n;
  }
  return { ok: true, value };
}

/** `{ sprite: frameKey | null }`. */
export function validateMapItemArt(body: unknown): Validated<MapItemArtValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = Object.keys(body).find((k) => k !== "sprite");
  if (extra !== undefined) return { ok: false, field: extra };
  const s = body.sprite;
  if (s === null) return { ok: true, value: { sprite: null } };
  if (typeof s !== "string" || !SPRITE_KEY_RE.test(s) || !isFrameKey(s)) {
    return { ok: false, field: "sprite" };
  }
  return { ok: true, value: { sprite: s } };
}
