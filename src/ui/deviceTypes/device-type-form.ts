import type {
  DeviceKind,
  DeviceTypeCreateValue,
  DeviceTypeDto,
  DeviceTypePatchValue,
} from "@/lib/device-types/types";
import { validateDeviceTypeCreate, validateDeviceTypePatch } from "@/lib/validate/device-type";
import { deviceTypesCopy } from "../copy/deviceTypes";

export type DeviceTypeForm = { name: string; slot: DeviceKind; sprite: string | null };

export const emptyForm = (): DeviceTypeForm => ({ name: "", slot: "other", sprite: null });
export const formFromType = (t: DeviceTypeDto): DeviceTypeForm => ({
  name: t.name,
  slot: t.slot,
  sprite: t.sprite,
});

export function fieldMessage(field: string): string {
  const e = deviceTypesCopy.fieldErrors;
  if (field === "name") return e.name;
  if (field === "slot") return e.slot;
  if (field === "sprite") return e.sprite;
  return e.body;
}

export type CreateResult =
  | { kind: "ok"; body: DeviceTypeCreateValue }
  | { kind: "invalid"; message: string };
export type PatchResult =
  | { kind: "ok"; body: DeviceTypePatchValue }
  | { kind: "unchanged" }
  | { kind: "invalid"; message: string };

export function toCreateBody(form: DeviceTypeForm): CreateResult {
  const v = validateDeviceTypeCreate(form);
  return v.ok ? { kind: "ok", body: v.value } : { kind: "invalid", message: fieldMessage(v.field) };
}

const norm = (s: string) => s.normalize("NFC").replace(/\s+/gu, " ").trim();

/** Sends only the changed fields; a name that differs only by spaces or normalization is unchanged. */
export function toPatchBody(form: DeviceTypeForm, type: DeviceTypeDto): PatchResult {
  const changed: Partial<DeviceTypeForm> = {};
  if (norm(form.name) !== type.name) changed.name = form.name;
  if (form.slot !== type.slot) changed.slot = form.slot;
  if (form.sprite !== type.sprite) changed.sprite = form.sprite;
  if (Object.keys(changed).length === 0) return { kind: "unchanged" };
  const v = validateDeviceTypePatch(changed);
  return v.ok ? { kind: "ok", body: v.value } : { kind: "invalid", message: fieldMessage(v.field) };
}
