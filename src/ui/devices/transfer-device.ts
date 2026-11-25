import type { DeviceDto, HandoffDto, HandoffStartValue } from "@/lib/devices/types";
import { todayUtc7 } from "@/lib/devices/holding";
import { validateHandoffStart } from "@/lib/validate/device";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { seatsCopy } from "../copy/seats";
import type { DevicesResult } from "./devices-api";

export type TransferForm = { note: string };

export const emptyTransferForm = (): TransferForm => ({ note: "" });

const copy = devicesCopy.transfer;

function fieldMessage(field: string): string {
  if (field === "note") return devicesCopy.assign.errors.noteInvalid;
  if (field === "toMemberId") return seatsCopy.actions.pickerNone;
  return copy.errors.invalid;
}

export type TransferBodyResult =
  | { kind: "ok"; body: HandoffStartValue }
  | { kind: "invalid"; message: string };

/** The server's own validator (NFC, trim, blank to null, 500 limit), so the client and server agree. */
export function toTransferBody(form: TransferForm, memberId: string | null): TransferBodyResult {
  if (memberId === null) return { kind: "invalid", message: seatsCopy.actions.pickerNone };
  const v = validateHandoffStart(
    { kind: "transfer", toMemberId: memberId, note: form.note },
    todayUtc7(new Date()),
  );
  return v.ok ? { kind: "ok", body: v.value } : { kind: "invalid", message: fieldMessage(v.field) };
}

export type TransferSettled =
  | { kind: "done" }
  | { kind: "error"; message: string; stale: boolean; reloadMembers: boolean };

const STALE = ["handoff_pending", "not_allowed", "device_unowned", "invalid_recipient"];

/** A gone device counts as done; a stale view refreshes the list; a refused member reloads the picker. */
export function settleTransfer(result: DevicesResult<HandoffDto>): TransferSettled {
  if (result.ok || result.code === "not_found") return { kind: "done" };
  const { code } = result;
  return {
    kind: "error",
    message: code === "invalid_request" ? copy.errors.invalid : apiErrorMessage(code),
    stale: STALE.includes(code),
    reloadMembers: code === "member_not_assignable",
  };
}

const AUTH_CODES = ["unauthenticated", "forbidden", "member_deactivated", "org_required"];
export const NOTHING_CHANGED = [...AUTH_CODES, "unavailable", "internal", "invalid_request"];

export type CancelTransferOutcome = {
  refresh: boolean;
  notice: { tone: "status" | "error"; text: string };
};

/** What the page does after a cancel, from the result only. */
export function cancelOutcome(
  result: DevicesResult<HandoffDto>,
  device: Pick<DeviceDto, "name" | "inventoryNumber">,
  kind: "transfer" | "return" | "extension",
): CancelTransferOutcome {
  const c =
    kind === "return" ? devicesCopy.giveBack : kind === "extension" ? devicesCopy.extend : copy;
  if (result.ok) {
    return {
      refresh: true,
      notice: { tone: "status", text: c.cancelled(device.name, device.inventoryNumber) },
    };
  }
  const { code } = result;
  if (code === "handoff_not_pending" || code === "not_found") {
    return { refresh: true, notice: { tone: "status", text: c.gone } };
  }
  return {
    refresh: !NOTHING_CHANGED.includes(code),
    notice: { tone: "error", text: apiErrorMessage(code) },
  };
}
