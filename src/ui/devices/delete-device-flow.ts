import { apiErrorMessage } from "../copy/api";
import type { DevicesResult } from "./devices-api";

export type DeleteSettled = { kind: "done" } | { kind: "error"; message: string; stale: boolean };

/** The device changed under the dialog: the list behind it is out of date. */
const STALE_CODES: readonly string[] = ["device_owned", "handoff_pending"];

/** A device already gone counts as done; any other refusal is shown, and a stale one also refreshes the list. */
export function settleDelete(r: DevicesResult<void>): DeleteSettled {
  if (r.ok || r.code === "not_found") return { kind: "done" };
  return { kind: "error", message: apiErrorMessage(r.code), stale: STALE_CODES.includes(r.code) };
}
