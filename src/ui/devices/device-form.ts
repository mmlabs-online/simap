import type {
  DeviceCreateValue,
  DeviceDto,
  DevicePatchValue,
  PlacementFilter,
} from "@/lib/devices/types";
import { normalizeMac, validateDeviceCreate, validateDevicePatch } from "@/lib/validate/device";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import type { PickerMember } from "../seats/member-picker";

export type DeviceOwner = { kind: "me" } | { kind: "member"; member: PickerMember | null };

export type DeviceForm = {
  name: string;
  type: string;
  inventoryNumber: string;
  mac: string;
  owner: DeviceOwner;
};

export const emptyForm = (): DeviceForm => ({
  name: "",
  type: "",
  inventoryNumber: "",
  mac: "",
  owner: { kind: "me" },
});

export const formFromDevice = (d: DeviceDto): DeviceForm => ({
  name: d.name,
  type: d.type,
  inventoryNumber: d.inventoryNumber,
  mac: d.mac ?? "",
  owner: { kind: "me" },
});

export function fieldMessage(field: string): string {
  const messages: Record<string, string> = devicesCopy.form.fieldErrors;
  return messages[field] ?? devicesCopy.form.fieldErrors.body;
}

/** `ownerId` is absent (not null) unless an Admin picked another member. */
export type DeviceCreateBody = Omit<DeviceCreateValue, "ownerId"> & { ownerId?: string };

export type CreateResult =
  | { kind: "ok"; body: DeviceCreateBody }
  | { kind: "invalid"; message: string };

export function toCreateBody(form: DeviceForm, opts: { isAdmin: boolean }): CreateResult {
  const other = opts.isAdmin && form.owner.kind === "member" ? form.owner.member : undefined;
  if (opts.isAdmin && form.owner.kind === "member" && !other) {
    return { kind: "invalid", message: fieldMessage("ownerId") };
  }
  const v = validateDeviceCreate({
    name: form.name,
    type: form.type,
    inventoryNumber: form.inventoryNumber,
    mac: form.mac,
    ...(other ? { ownerId: other.id } : {}),
  });
  if (!v.ok) return { kind: "invalid", message: fieldMessage(v.field) };
  const { name, type, inventoryNumber, mac, ownerId } = v.value;
  return {
    kind: "ok",
    body: { name, type, inventoryNumber, mac, ...(ownerId !== null ? { ownerId } : {}) },
  };
}

export type PatchResult =
  | { kind: "ok"; body: DevicePatchValue }
  | { kind: "unchanged" }
  | { kind: "invalid"; message: string };

const TEXT_FIELDS = ["name", "type", "inventoryNumber"] as const;

/** Sends only the fields that changed; the owner is never part of a patch. */
export function toPatchBody(form: DeviceForm, device: DeviceDto): PatchResult {
  const changed: Record<string, string | null> = {};
  for (const f of TEXT_FIELDS) {
    if (form[f].normalize("NFC").trim() !== device[f]) changed[f] = form[f];
  }
  const mac = normalizeMac(form.mac);
  if (mac === undefined) changed.mac = form.mac;
  else if (mac !== device.mac) changed.mac = mac;
  if (Object.keys(changed).length === 0) return { kind: "unchanged" };
  const v = validateDevicePatch(changed);
  return v.ok ? { kind: "ok", body: v.value } : { kind: "invalid", message: fieldMessage(v.field) };
}

export function deviceErrorMessage(code: string): string {
  return code === "member_not_assignable"
    ? devicesCopy.form.errors.memberNotAssignable
    : apiErrorMessage(code);
}

/** A new device is in inventory, so the Placed filter would hide it. */
export const filterAfterCreate = (f: PlacementFilter): PlacementFilter =>
  f === "placed" ? "all" : f;
