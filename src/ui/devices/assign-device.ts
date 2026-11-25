import type { AssignValue, DeviceDto, HoldingPatchValue } from "@/lib/devices/types";
import { todayUtc7 } from "@/lib/devices/holding";
import { validateAssign, validateHoldingPatch } from "@/lib/validate/device";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { seatsCopy } from "../copy/seats";
import type { DevicesResult } from "./devices-api";

export type AssignMode = "assign" | "edit";

export type AssignForm = { note: string; noExpiry: boolean; expiresOn: string };

/** Today in UTC+7 (D35). Read once when a dialog opens, never inside the pure helpers. */
export const todayNow = (): string => todayUtc7(new Date());

export const emptyAssignForm = (): AssignForm => ({ note: "", noExpiry: true, expiresOn: "" });

export function holdingForm(d: DeviceDto): AssignForm {
  const h = d.holding;
  return {
    note: h?.note ?? "",
    noExpiry: h?.expiresOn == null,
    expiresOn: h?.expiresOn ?? "",
  };
}

/** The `min` of the date input. An overdue holding keeps its own date so a note-only save is not blocked. */
export function expiryMin(
  mode: AssignMode,
  holding: { expiresOn: string | null } | null,
  today: string,
): string {
  const current = holding?.expiresOn ?? null;
  return mode === "edit" && current !== null && current < today ? current : today;
}

/** Code points, like the server's limit. */
export const noteLength = (s: string): number => [...s].length;

const errors = devicesCopy.assign.errors;

function fieldMessage(field: string): string {
  if (field === "note") return errors.noteInvalid;
  if (field === "expiresOn") return errors.expiryPast;
  if (field === "memberId") return seatsCopy.actions.pickerNone;
  return errors.invalid;
}

const cleanNote = (s: string): string | null =>
  s.replace(/\r\n/g, "\n").normalize("NFC").trim() || null;

export type AssignBodyResult =
  | { kind: "ok"; body: AssignValue }
  | { kind: "invalid"; message: string };

export function toAssignBody(
  form: AssignForm,
  memberId: string | null,
  today: string,
): AssignBodyResult {
  if (memberId === null) return { kind: "invalid", message: seatsCopy.actions.pickerNone };
  if (!form.noExpiry && form.expiresOn === "") {
    return { kind: "invalid", message: errors.expiryMissing };
  }
  const v = validateAssign(
    { memberId, note: form.note, expiresOn: form.noExpiry ? null : form.expiresOn },
    today,
  );
  return v.ok ? { kind: "ok", body: v.value } : { kind: "invalid", message: fieldMessage(v.field) };
}

export type HoldingBodyResult =
  | { kind: "ok"; body: HoldingPatchValue }
  | { kind: "unchanged" }
  | { kind: "invalid"; message: string };

/** Sends only the keys that changed; an overdue holding stays editable while its date is untouched. */
export function toHoldingBody(
  form: AssignForm,
  device: DeviceDto,
  today: string,
): HoldingBodyResult {
  const current = device.holding;
  if (!form.noExpiry && form.expiresOn === "") {
    return { kind: "invalid", message: errors.expiryMissing };
  }
  const changed: Record<string, string | null> = {};
  if (cleanNote(form.note) !== (current?.note ?? null)) changed.note = form.note;
  const expiresOn = form.noExpiry ? null : form.expiresOn;
  if (expiresOn !== (current?.expiresOn ?? null)) changed.expiresOn = expiresOn;
  if (Object.keys(changed).length === 0) return { kind: "unchanged" };
  const v = validateHoldingPatch(changed, today);
  return v.ok ? { kind: "ok", body: v.value } : { kind: "invalid", message: fieldMessage(v.field) };
}

export type AssignSettled =
  | { kind: "done" }
  | { kind: "error"; message: string; stale: boolean; reloadMembers: boolean };

const STALE = ["device_owned", "not_assigned", "not_allowed", "handoff_pending"];

/** A gone device counts as done; a stale view refreshes the list; a refused member reloads the picker. */
export function settleAssign(result: DevicesResult<DeviceDto>): AssignSettled {
  if (result.ok || result.code === "not_found") return { kind: "done" };
  const { code } = result;
  return {
    kind: "error",
    message: code === "invalid_request" ? errors.invalid : apiErrorMessage(code),
    stale: STALE.includes(code),
    reloadMembers: code === "member_not_assignable",
  };
}
