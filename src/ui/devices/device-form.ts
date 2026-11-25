import type {
  DeviceCreateValue,
  DeviceDto,
  DevicePatchValue,
  PlacementFilter,
} from "@/lib/devices/types";
import { normalizeMac, validateDeviceCreate, validateDevicePatch } from "@/lib/validate/device";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";

export type DeviceForm = {
  name: string;
  type: string;
  inventoryNumber: string;
  mac: string;
  serial: string;
  manufacturer: string;
  brand: string;
};

export const emptyForm = (): DeviceForm => ({
  name: "",
  type: "",
  inventoryNumber: "",
  mac: "",
  serial: "",
  manufacturer: "",
  brand: "",
});

export const formFromDevice = (d: DeviceDto): DeviceForm => ({
  name: d.name,
  type: d.type,
  inventoryNumber: d.inventoryNumber,
  mac: d.mac ?? "",
  serial: d.serial ?? "",
  manufacturer: d.manufacturer ?? "",
  brand: d.brand ?? "",
});

export function fieldMessage(field: string): string {
  const messages: Record<string, string> = devicesCopy.form.fieldErrors;
  return messages[field] ?? devicesCopy.form.fieldErrors.body;
}

/** A new device has no owner (DEV-01): the body never carries one. */
export type DeviceCreateBody = DeviceCreateValue;

export type CreateResult =
  | { kind: "ok"; body: DeviceCreateBody }
  | { kind: "invalid"; message: string };

export function toCreateBody(form: DeviceForm): CreateResult {
  const v = validateDeviceCreate({
    name: form.name,
    type: form.type,
    inventoryNumber: form.inventoryNumber,
    mac: form.mac,
    serial: form.serial,
    manufacturer: form.manufacturer,
    brand: form.brand,
  });
  if (!v.ok) return { kind: "invalid", message: fieldMessage(v.field) };
  return { kind: "ok", body: v.value };
}

export type PatchResult =
  | { kind: "ok"; body: DevicePatchValue }
  | { kind: "unchanged" }
  | { kind: "invalid"; message: string };

const TEXT_FIELDS = ["name", "type", "inventoryNumber"] as const;
const OPT_FIELDS = ["serial", "manufacturer", "brand"] as const;

/** Sends only the fields that changed; the owner is never part of a patch. */
export function toPatchBody(form: DeviceForm, device: DeviceDto): PatchResult {
  const changed: Record<string, string | null> = {};
  for (const f of TEXT_FIELDS) {
    if (form[f].normalize("NFC").trim() !== device[f]) changed[f] = form[f];
  }
  const mac = normalizeMac(form.mac);
  if (mac === undefined) changed.mac = form.mac;
  else if (mac !== device.mac) changed.mac = mac;
  for (const f of OPT_FIELDS) {
    const next = form[f].normalize("NFC").trim() || null;
    if (next !== device[f]) changed[f] = next;
  }
  if (Object.keys(changed).length === 0) return { kind: "unchanged" };
  const v = validateDevicePatch(changed);
  return v.ok ? { kind: "ok", body: v.value } : { kind: "invalid", message: fieldMessage(v.field) };
}

export const deviceErrorMessage = (code: string): string => apiErrorMessage(code);

/** A new device is in inventory, so the Placed filter would hide it. */
export const filterAfterCreate = (f: PlacementFilter): PlacementFilter =>
  f === "placed" ? "all" : f;
