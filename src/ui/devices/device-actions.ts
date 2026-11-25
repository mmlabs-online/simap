import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { placeModes, type PlaceMode } from "./place-device";

/** Row action handlers. No handler means no action. */
export type DeviceRowHandlers = {
  onPlace?: (device: DeviceDto, mode: PlaceMode) => void;
  onEdit?: (device: DeviceDto) => void;
  onDelete?: (device: DeviceDto) => void;
};

export type RowAction = {
  key: string;
  label: string;
  ariaLabel: string;
  run: () => void;
  danger?: boolean;
};

const PLACE_LABELS: Record<PlaceMode, { label: string; aria: (inv: string) => string }> = {
  place: { label: devicesCopy.actions.place, aria: devicesCopy.actions.placeAria },
  move: { label: devicesCopy.actions.move, aria: devicesCopy.actions.moveAria },
  return: { label: devicesCopy.actions.return, aria: devicesCopy.actions.returnAria },
};

/** The actions a row offers. The server's `canPlace` flag gates them; no handler means no action. */
export function rowActions(d: DeviceDto, h: DeviceRowHandlers): RowAction[] {
  const out: RowAction[] = [];
  const { onPlace, onEdit, onDelete } = h;
  if (onPlace) {
    for (const mode of placeModes(d)) {
      out.push({
        key: mode,
        label: PLACE_LABELS[mode].label,
        ariaLabel: PLACE_LABELS[mode].aria(d.inventoryNumber),
        run: () => onPlace(d, mode),
      });
    }
  }
  if (onEdit && d.canEdit) {
    out.push({
      key: "edit",
      label: devicesCopy.actions.edit,
      ariaLabel: devicesCopy.actions.editAria(d.inventoryNumber),
      run: () => onEdit(d),
    });
  }
  if (onDelete && d.canDelete) {
    out.push({
      key: "delete",
      label: devicesCopy.actions.delete,
      ariaLabel: devicesCopy.actions.deleteAria(d.inventoryNumber),
      danger: true,
      run: () => onDelete(d),
    });
  }
  return out;
}

export const hasAnyAction = (devices: DeviceDto[], h: DeviceRowHandlers): boolean =>
  devices.some((d) => rowActions(d, h).length > 0);
