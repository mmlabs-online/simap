import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { placeModes, type PlaceMode } from "./place-device";

/** Row action handlers. Later slices add `onEdit` and `onDelete` here. */
export type DeviceRowHandlers = {
  onPlace?: (device: DeviceDto, mode: PlaceMode) => void;
};

export type RowAction = { key: string; label: string; ariaLabel: string; run: () => void };

const PLACE_LABELS: Record<PlaceMode, { label: string; aria: (inv: string) => string }> = {
  place: { label: devicesCopy.actions.place, aria: devicesCopy.actions.placeAria },
  move: { label: devicesCopy.actions.move, aria: devicesCopy.actions.moveAria },
  return: { label: devicesCopy.actions.return, aria: devicesCopy.actions.returnAria },
};

/** The actions a row offers. The server's `canPlace` flag gates them; no handler means no action. */
export function rowActions(d: DeviceDto, h: DeviceRowHandlers): RowAction[] {
  const onPlace = h.onPlace;
  if (!onPlace) return [];
  return placeModes(d).map((mode) => ({
    key: mode,
    label: PLACE_LABELS[mode].label,
    ariaLabel: PLACE_LABELS[mode].aria(d.inventoryNumber),
    run: () => onPlace(d, mode),
  }));
}

export const hasAnyAction = (devices: DeviceDto[], h: DeviceRowHandlers): boolean =>
  devices.some((d) => rowActions(d, h).length > 0);
