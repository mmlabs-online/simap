import type { HandoffDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import {
  handoffActionFailed,
  type IncomingOutcome,
  type IncomingResult,
} from "./incoming-transfer";

const copy = devicesCopy.extensions;

/** A failed approve or reject; a request that is no longer pending says so in extension words. */
function failed(code: string): IncomingOutcome {
  const out = handoffActionFailed(code);
  return out.notice.tone === "status"
    ? { ...out, notice: { ...out.notice, text: devicesCopy.extend.gone } }
    : out;
}

/** The Manager's Approve on a pending extension; the notice names the new expiry date. */
export function approveExtensionOutcome(
  result: IncomingResult,
  item: Pick<HandoffDto, "device" | "newExpiresOn">,
): IncomingOutcome {
  if (!result.ok) return failed(result.code);
  const { name, inventoryNumber } = item.device;
  return {
    refresh: true,
    notice: { tone: "status", text: copy.approved(name, inventoryNumber, item.newExpiresOn ?? "") },
  };
}

/** The Manager's Reject on a pending extension. */
export function rejectExtensionOutcome(
  result: IncomingResult,
  item: Pick<HandoffDto, "device">,
): IncomingOutcome {
  if (!result.ok) return failed(result.code);
  const { name, inventoryNumber } = item.device;
  return { refresh: true, notice: { tone: "status", text: copy.rejected(name, inventoryNumber) } };
}
