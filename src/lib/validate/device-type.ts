import {
  DEVICE_KINDS,
  DEVICE_TYPE_LIMITS,
  type DeviceKind,
  type DeviceTypeCreateValue,
  type DeviceTypePatchValue,
} from "@/lib/device-types/types";
import type { Validated } from "./room";

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/u;

/** NFC, Unicode whitespace runs collapsed to one space, trimmed, 1..60 code points, no control or format characters. */
function name(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (s === "" || CONTROL_OR_FORMAT.test(s) || [...s].length > DEVICE_TYPE_LIMITS.name) return null;
  return s;
}

const slot = (v: unknown): DeviceKind | null =>
  typeof v === "string" && (DEVICE_KINDS as readonly string[]).includes(v)
    ? (v as DeviceKind)
    : null;

export function validateDeviceTypeCreate(body: unknown): Validated<DeviceTypeCreateValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const extra = Object.keys(body).find((k) => k !== "name" && k !== "slot");
  if (extra !== undefined) return { ok: false, field: extra };
  const n = name(body.name);
  if (n === null) return { ok: false, field: "name" };
  const s = slot(body.slot);
  if (s === null) return { ok: false, field: "slot" };
  return { ok: true, value: { name: n, slot: s } };
}

/** A non-empty partial of name and slot. */
export function validateDeviceTypePatch(body: unknown): Validated<DeviceTypePatchValue> {
  if (!isPlainObject(body)) return { ok: false, field: "body" };
  const keys = Object.keys(body);
  const extra = keys.find((k) => k !== "name" && k !== "slot");
  if (extra !== undefined) return { ok: false, field: extra };
  if (keys.length === 0) return { ok: false, field: "body" };
  const value: DeviceTypePatchValue = {};
  if ("name" in body) {
    const n = name(body.name);
    if (n === null) return { ok: false, field: "name" };
    value.name = n;
  }
  if ("slot" in body) {
    const s = slot(body.slot);
    if (s === null) return { ok: false, field: "slot" };
    value.slot = s;
  }
  return { ok: true, value };
}
