import { parseCalendarDay } from "@/lib/devices/holding";
import {
  DEVICE_LIMITS,
  type AssignValue,
  type DeviceCreateValue,
  type DevicePatchValue,
  type DeviceRole,
  type HandoffBox,
  type HandoffStartValue,
  type HoldingPatchValue,
  type PlacementFilter,
} from "@/lib/devices/types";
import type { Validated } from "./room";
import { isCanonicalUuid } from "./uuid";

export type DeviceQueryResult = { ok: true; value: PlacementFilter } | { ok: false; field: string };
export type PlacementPutValue = {
  seatId: string | null;
  role: DeviceRole;
  expectedSeatId: string | null;
};

const FILTERS: readonly string[] = ["all", "placed", "inventory", "unowned"];

/** `?placement=`: absent or blank = all; repeated or unknown = invalid. Other keys are ignored. */
export function parseDeviceQuery(params: URLSearchParams): DeviceQueryResult {
  const all = params.getAll("placement");
  if (all.length > 1) return { ok: false, field: "placement" };
  const v = all[0];
  if (v === undefined || v === "") return { ok: true, value: "all" };
  if (!FILTERS.includes(v)) return { ok: false, field: "placement" };
  return { ok: true, value: v as PlacementFilter };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const uuidOrNull = (v: unknown): v is string | null => v === null || isCanonicalUuid(v);

export function validatePlacementPut(body: unknown): Validated<PlacementPutValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = Object.keys(body).find((k) => !["seatId", "role", "expectedSeatId"].includes(k));
  if (extra !== undefined) return { ok: false, field: extra };
  if (!("seatId" in body) || !uuidOrNull(body.seatId)) return { ok: false, field: "seatId" };
  if (!("expectedSeatId" in body) || !uuidOrNull(body.expectedSeatId)) {
    return { ok: false, field: "expectedSeatId" };
  }
  const role = body.role;
  if (body.seatId === null) {
    if (role !== undefined && role !== "secondary") return { ok: false, field: "role" };
    return {
      ok: true,
      value: { seatId: null, role: "secondary", expectedSeatId: body.expectedSeatId },
    };
  }
  if (role !== "primary" && role !== "secondary") return { ok: false, field: "role" };
  return { ok: true, value: { seatId: body.seatId, role, expectedSeatId: body.expectedSeatId } };
}

const MAC_FORMS = [
  /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i,
  /^([0-9a-f]{2}-){5}[0-9a-f]{2}$/i,
  /^([0-9a-f]{4}\.){2}[0-9a-f]{4}$/i,
  /^[0-9a-f]{12}$/i,
];

/**
 * Accepts the `:`, `-`, `.` (Cisco) and bare forms in any case; returns the lowercase colon form.
 * `null` = blank, `undefined` = invalid.
 */
export function normalizeMac(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (s === "") return null;
  if (!MAC_FORMS.some((re) => re.test(s))) return undefined;
  return s
    .replace(/[:.-]/g, "")
    .toLowerCase()
    .replace(/(..)(?=.)/g, "$1:");
}

const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;

/** NFC, trimmed, 1..max code points, no control or format characters. null = invalid. */
function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFC").trim();
  if (s === "" || CONTROL_OR_FORMAT.test(s) || [...s].length > max) return null;
  return s;
}

/** Like `text` but blank or null = null (no value) and invalid = undefined. */
function optText(v: unknown, max: number): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  if (v.trim() === "") return null;
  return text(v, max) ?? undefined;
}

const CONTROL_NOT_NEWLINE = /[^\P{Cc}\n]|\p{Cf}/u;

/** A note: like `optText` but line breaks are allowed (CRLF becomes LF). */
function noteText(v: unknown, max: number): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\r\n/g, "\n").normalize("NFC").trim();
  if (s === "") return null;
  if (CONTROL_NOT_NEWLINE.test(s) || [...s].length > max) return undefined;
  return s;
}

const TEXT_MAX = {
  name: DEVICE_LIMITS.name,
  type: DEVICE_LIMITS.type,
  inventoryNumber: DEVICE_LIMITS.inventoryNumber,
} as const;

const OPT_MAX = {
  serial: DEVICE_LIMITS.serial,
  manufacturer: DEVICE_LIMITS.manufacturer,
  brand: DEVICE_LIMITS.brand,
} as const;
const OPT_KEYS = ["serial", "manufacturer", "brand"] as const;

/** Holding keys (note, expiry) are never accepted here: only DEV-07 changes them. */
const DEVICE_KEYS: readonly string[] = ["name", "type", "inventoryNumber", "mac", ...OPT_KEYS];

export function validateDeviceCreate(body: unknown): Validated<DeviceCreateValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  // `ownerId` is an unknown key: a new device has no owner (DEV-01)
  const extra = Object.keys(body).find((k) => !DEVICE_KEYS.includes(k));
  if (extra !== undefined) return { ok: false, field: extra };
  const name = text(body.name, TEXT_MAX.name);
  if (name === null) return { ok: false, field: "name" };
  const type = text(body.type, TEXT_MAX.type);
  if (type === null) return { ok: false, field: "type" };
  const inventoryNumber = text(body.inventoryNumber, TEXT_MAX.inventoryNumber);
  if (inventoryNumber === null) return { ok: false, field: "inventoryNumber" };
  const mac = body.mac === undefined ? null : normalizeMac(body.mac);
  if (mac === undefined) return { ok: false, field: "mac" };
  const opt = {} as Record<(typeof OPT_KEYS)[number], string | null>;
  for (const k of OPT_KEYS) {
    const t = body[k] === undefined ? null : optText(body[k], OPT_MAX[k]);
    if (t === undefined) return { ok: false, field: k };
    opt[k] = t;
  }
  return { ok: true, value: { name, type, inventoryNumber, mac, ...opt } };
}

/** A non-empty partial of the device fields. `ownerId` is an unknown key: the owner never changes. */
export function validateDevicePatch(body: unknown): Validated<DevicePatchValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const keys = Object.keys(body);
  const extra = keys.find((k) => !DEVICE_KEYS.includes(k));
  if (extra !== undefined) return { ok: false, field: extra };
  if (keys.length === 0) return { ok: false, field: "body" };
  const value: DevicePatchValue = {};
  for (const k of ["name", "type", "inventoryNumber"] as const) {
    if (!(k in body)) continue;
    const t = text(body[k], TEXT_MAX[k]);
    if (t === null) return { ok: false, field: k };
    value[k] = t;
  }
  if ("mac" in body) {
    const mac = normalizeMac(body.mac);
    if (mac === undefined) return { ok: false, field: "mac" };
    value.mac = mac;
  }
  for (const k of OPT_KEYS) {
    if (!(k in body)) continue;
    const t = optText(body[k], OPT_MAX[k]);
    if (t === undefined) return { ok: false, field: k };
    value[k] = t;
  }
  return { ok: true, value };
}

/** `undefined`/null/blank = no expiry (null); invalid or before `today` = undefined. `today` is a UTC+7 day. */
function expiry(v: unknown, today: string): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const day = parseCalendarDay(v);
  if (day === null || day < today) return undefined;
  return day;
}

/** DEV-07 assign body. The clock is injected (`today` = `todayUtc7(now)`). */
export function validateAssign(body: unknown, today: string): Validated<AssignValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = Object.keys(body).find((k) => !["memberId", "note", "expiresOn"].includes(k));
  if (extra !== undefined) return { ok: false, field: extra };
  if (!isCanonicalUuid(body.memberId)) return { ok: false, field: "memberId" };
  const note = body.note === undefined ? null : noteText(body.note, DEVICE_LIMITS.note);
  if (note === undefined) return { ok: false, field: "note" };
  const expiresOn = expiry(body.expiresOn, today);
  if (expiresOn === undefined) return { ok: false, field: "expiresOn" };
  return { ok: true, value: { memberId: body.memberId, note, expiresOn } };
}

/** DEV-08 / DEV-09 start body: `transfer` or `return`. `extension` comes with SIM-037.5. */
export function validateHandoffStart(body: unknown): Validated<HandoffStartValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const isReturn = body.kind === "return";
  const allowed = isReturn ? ["kind", "note"] : ["kind", "toMemberId", "note"];
  const extra = Object.keys(body).find((k) => !allowed.includes(k));
  if (extra !== undefined) return { ok: false, field: extra };
  if (body.kind !== "transfer" && !isReturn) return { ok: false, field: "kind" };
  const note = body.note === undefined ? null : noteText(body.note, DEVICE_LIMITS.note);
  if (note === undefined) return { ok: false, field: "note" };
  if (isReturn) return { ok: true, value: { kind: "return", note } };
  if (!isCanonicalUuid(body.toMemberId)) return { ok: false, field: "toMemberId" };
  return { ok: true, value: { kind: "transfer", toMemberId: body.toMemberId, note } };
}

/** `GET /api/handoffs?box=`: exactly one `box`, `incoming` or `returns`. */
export function validateHandoffBox(params: URLSearchParams): Validated<HandoffBox> {
  const all = params.getAll("box");
  if (all.length !== 1 || (all[0] !== "incoming" && all[0] !== "returns")) {
    return { ok: false, field: "box" };
  }
  return { ok: true, value: all[0] };
}

/** DEV-07 holding edit: a non-empty partial; only the keys sent are checked (an overdue note stays editable). */
export function validateHoldingPatch(body: unknown, today: string): Validated<HoldingPatchValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const keys = Object.keys(body);
  const extra = keys.find((k) => !["note", "expiresOn"].includes(k));
  if (extra !== undefined) return { ok: false, field: extra };
  if (keys.length === 0) return { ok: false, field: "body" };
  const value: HoldingPatchValue = {};
  if ("note" in body) {
    const note = body.note === undefined ? null : noteText(body.note, DEVICE_LIMITS.note);
    if (note === undefined) return { ok: false, field: "note" };
    value.note = note;
  }
  if ("expiresOn" in body) {
    const expiresOn = expiry(body.expiresOn, today);
    if (expiresOn === undefined) return { ok: false, field: "expiresOn" };
    value.expiresOn = expiresOn;
  }
  return { ok: true, value };
}
