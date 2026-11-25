import {
  DEVICE_LIMITS,
  type DeviceCreateValue,
  type DevicePatchValue,
  type DeviceRole,
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

const TEXT_MAX = {
  name: DEVICE_LIMITS.name,
  type: DEVICE_LIMITS.type,
  inventoryNumber: DEVICE_LIMITS.inventoryNumber,
} as const;

export function validateDeviceCreate(body: unknown): Validated<DeviceCreateValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  // `ownerId` is an unknown key: a new device has no owner (DEV-01)
  const extra = Object.keys(body).find(
    (k) => !["name", "type", "inventoryNumber", "mac"].includes(k),
  );
  if (extra !== undefined) return { ok: false, field: extra };
  const name = text(body.name, TEXT_MAX.name);
  if (name === null) return { ok: false, field: "name" };
  const type = text(body.type, TEXT_MAX.type);
  if (type === null) return { ok: false, field: "type" };
  const inventoryNumber = text(body.inventoryNumber, TEXT_MAX.inventoryNumber);
  if (inventoryNumber === null) return { ok: false, field: "inventoryNumber" };
  const mac = body.mac === undefined ? null : normalizeMac(body.mac);
  if (mac === undefined) return { ok: false, field: "mac" };
  return { ok: true, value: { name, type, inventoryNumber, mac } };
}

/** A non-empty partial of name, type, inventoryNumber and mac. `ownerId` is an unknown key: the owner never changes. */
export function validateDevicePatch(body: unknown): Validated<DevicePatchValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const keys = Object.keys(body);
  const extra = keys.find((k) => !["name", "type", "inventoryNumber", "mac"].includes(k));
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
  return { ok: true, value };
}
