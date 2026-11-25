import type { HandoffDto, HandoffStartValue } from "@/lib/devices/types";
import { validateHandoffStart } from "@/lib/validate/device";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import type { DevicesResult } from "./devices-api";

export type ExtendForm = { newExpiresOn: string; note: string };

export const emptyExtendForm = (): ExtendForm => ({ newExpiresOn: "", note: "" });

const copy = devicesCopy.extend;

/** The day after a `YYYY-MM-DD` day, by UTC calendar arithmetic (never local time). */
export function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export type ExtendBodyResult =
  | { kind: "ok"; body: Extract<HandoffStartValue, { kind: "extension" }> }
  | { kind: "invalid"; message: string };

/** The server's own validator (date after `today`, NFC, trim, blank note to null, 500 limit), so the client and server agree. */
export function toExtendBody(form: ExtendForm, today: string): ExtendBodyResult {
  const v = validateHandoffStart(
    { kind: "extension", newExpiresOn: form.newExpiresOn, note: form.note },
    today,
  );
  if (!v.ok) {
    return {
      kind: "invalid",
      message:
        v.field === "newExpiresOn"
          ? copy.errors.dateInvalid
          : v.field === "note"
            ? devicesCopy.assign.errors.noteInvalid
            : copy.errors.invalid,
    };
  }
  return { kind: "ok", body: v.value as Extract<HandoffStartValue, { kind: "extension" }> };
}

export type ExtendSettled = { kind: "done" } | { kind: "error"; message: string; stale: boolean };

const EXTEND_STALE = ["handoff_pending", "not_allowed", "device_unowned"];

/** A gone device counts as done; a stale view refreshes the list. */
export function settleExtend(result: DevicesResult<HandoffDto>): ExtendSettled {
  if (result.ok || result.code === "not_found") return { kind: "done" };
  const { code } = result;
  return {
    kind: "error",
    message: code === "invalid_request" ? copy.errors.invalid : apiErrorMessage(code),
    stale: EXTEND_STALE.includes(code),
  };
}
