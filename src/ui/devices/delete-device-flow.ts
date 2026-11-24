import type { DeviceDto } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import type { DevicesResult } from "./devices-api";
import { toPlacementBody, type PlacementBody } from "./place-device";

/** A placed device must go back to inventory first (D31); only then is the delete confirmed. */
export type DeleteStep = "placed" | "confirm";

/** The step follows the current device, so it cannot disagree with it. */
export const deleteStep = (d: DeviceDto): DeleteStep => (d.placement ? "placed" : "confirm");

export const deleteSubmitLabel = (step: DeleteStep): string => devicesCopy.delete.submit[step];

/** Move to inventory, guarded by the seat the dialog last saw. */
export const moveBody = (d: DeviceDto): PlacementBody => toPlacementBody(d, null);

export type DeleteSettled =
  | { kind: "done" }
  | { kind: "placed"; message: string }
  | { kind: "error"; message: string };

/** A device already gone counts as done; a placed one sends the dialog back to the move step. */
export function settleDelete(r: DevicesResult<void>): DeleteSettled {
  if (r.ok || r.code === "not_found") return { kind: "done" };
  const message = apiErrorMessage(r.code);
  return r.code === "device_placed" ? { kind: "placed", message } : { kind: "error", message };
}

export type MoveSettled =
  | { kind: "confirm"; device: DeviceDto }
  | { kind: "done" }
  | { kind: "refetch"; message: string }
  | { kind: "error"; message: string };

/** A successful move is never done: the user still confirms the delete. */
export function settleMove(r: DevicesResult<DeviceDto>): MoveSettled {
  if (r.ok) return { kind: "confirm", device: r.value };
  if (r.code === "not_found") return { kind: "done" };
  const message = apiErrorMessage(r.code);
  return r.code === "placement_changed" ? { kind: "refetch", message } : { kind: "error", message };
}

export type RefetchSettled =
  | { kind: "device"; device: DeviceDto }
  | { kind: "done" }
  | { kind: "error"; message: string };

export function afterRefetch(r: DevicesResult<DeviceDto>): RefetchSettled {
  if (r.ok) return { kind: "device", device: r.value };
  if (r.code === "not_found") return { kind: "done" };
  return { kind: "error", message: apiErrorMessage(r.code) };
}
