import type {
  DeviceDto,
  HandoffDto,
  HandoffStartValue,
  PlacementFilter,
} from "@/lib/devices/types";
import { validateHandoffStart } from "@/lib/validate/device";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import type { DevicesResult } from "./devices-api";
import { handoffActionFailed, type IncomingOutcome } from "./incoming-transfer";

export type ReturnForm = { note: string };

export const emptyReturnForm = (): ReturnForm => ({ note: "" });

const copy = devicesCopy.giveBack;

export type ReturnBodyResult =
  | { kind: "ok"; body: Extract<HandoffStartValue, { kind: "return" }> }
  | { kind: "invalid"; message: string };

/** The server's own validator (NFC, trim, blank to null, 500 limit), so the client and server agree. */
export function toReturnBody(form: ReturnForm): ReturnBodyResult {
  const v = validateHandoffStart({ kind: "return", note: form.note });
  if (!v.ok) {
    return {
      kind: "invalid",
      message: v.field === "note" ? devicesCopy.assign.errors.noteInvalid : copy.errors.invalid,
    };
  }
  return { kind: "ok", body: v.value as Extract<HandoffStartValue, { kind: "return" }> };
}

export type ReturnSettled = { kind: "done" } | { kind: "error"; message: string; stale: boolean };

const RETURN_STALE = ["handoff_pending", "not_allowed", "device_unowned"];

/** A gone device counts as done; a stale view refreshes the list. */
export function settleReturn(result: DevicesResult<HandoffDto>): ReturnSettled {
  if (result.ok || result.code === "not_found") return { kind: "done" };
  const { code } = result;
  return {
    kind: "error",
    message:
      code === "invalid_request"
        ? copy.errors.invalid
        : code === "device_unowned"
          ? copy.errors.alreadyUnowned
          : apiErrorMessage(code),
    stale: RETURN_STALE.includes(code),
  };
}

/** The Admin's Confirm on a pending return. The filter hint shows only under Placed, where the device leaves the list. */
export function confirmReturnOutcome(
  result: DevicesResult<HandoffDto>,
  item: Pick<HandoffDto, "device">,
  filter: PlacementFilter,
): IncomingOutcome {
  if (!result.ok) {
    const out = handoffActionFailed(result.code);
    // A return that is no longer pending says so in return words, not transfer words.
    return out.notice.tone === "status"
      ? { ...out, notice: { ...out.notice, text: copy.gone } }
      : out;
  }
  const base = devicesCopy.returns.confirmed(item.device.name, item.device.inventoryNumber);
  const hint = filter === "placed" ? ` ${devicesCopy.returns.filterHint}` : "";
  return { refresh: true, notice: { tone: "status", text: base + hint } };
}

export type TakeBackSettled = { kind: "done" } | { kind: "error"; message: string; stale: boolean };

const TAKE_BACK_STALE = ["handoff_pending", "placement_changed", "device_unowned", "not_allowed"];

/** A gone device counts as done; a stale view refreshes the list. */
export function settleTakeBack(result: DevicesResult<DeviceDto>): TakeBackSettled {
  if (result.ok || result.code === "not_found") return { kind: "done" };
  const { code } = result;
  return {
    kind: "error",
    message:
      code === "device_unowned"
        ? devicesCopy.takeBack.errors.alreadyUnowned
        : apiErrorMessage(code),
    stale: TAKE_BACK_STALE.includes(code),
  };
}

/** The notice after a take-back; the filter hint shows only under Placed. */
export function takeBackDone(
  device: Pick<DeviceDto, "name" | "inventoryNumber">,
  filter: PlacementFilter,
): string {
  const base = devicesCopy.takeBack.done(device.name, device.inventoryNumber);
  return filter === "placed" ? `${base} ${devicesCopy.returns.filterHint}` : base;
}

/** What the take-back confirmation shows. */
export function takeBackBody(device: DeviceDto): {
  owner: string;
  seat: string | null;
  cancelsTransfer: boolean;
} {
  return {
    owner: device.owner?.displayName ?? "",
    seat: device.placement?.seatCode ?? null,
    cancelsTransfer: device.pendingHandoff?.kind === "transfer",
  };
}
