import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import type { AssignMode } from "./assign-device";
import { placeModes, type PlaceMode } from "./place-device";

/** Row action handlers. No handler means no action. */
export type DeviceRowHandlers = {
  onAssign?: (device: DeviceDto, mode: AssignMode) => void;
  onEditHolding?: (device: DeviceDto, mode: AssignMode) => void;
  onPlace?: (device: DeviceDto, mode: PlaceMode) => void;
  onEdit?: (device: DeviceDto) => void;
  onDelete?: (device: DeviceDto) => void;
  onTransfer?: (device: DeviceDto) => void;
  onCancelHandoff?: (device: DeviceDto) => void;
  onReturn?: (device: DeviceDto) => void;
  onTakeBack?: (device: DeviceDto) => void;
};

export type RowAction = {
  key: string;
  label: string;
  ariaLabel: string;
  run: () => void;
  danger?: boolean;
  disabled?: boolean;
};

const PLACE_LABELS: Record<PlaceMode, { label: string; aria: (inv: string) => string }> = {
  place: { label: devicesCopy.actions.place, aria: devicesCopy.actions.placeAria },
  move: { label: devicesCopy.actions.move, aria: devicesCopy.actions.moveAria },
  return: { label: devicesCopy.actions.return, aria: devicesCopy.actions.returnAria },
};

/**
 * The actions a row offers. The server's flags gate them; no handler means no action. While `busyId` is
 * this row's id, every action of the row is disabled.
 */
export function rowActions(
  d: DeviceDto,
  h: DeviceRowHandlers,
  busyId?: string | null,
): RowAction[] {
  const out: RowAction[] = [];
  const {
    onAssign,
    onEditHolding,
    onPlace,
    onEdit,
    onDelete,
    onTransfer,
    onCancelHandoff,
    onReturn,
    onTakeBack,
  } = h;
  const pending = d.pendingHandoff;
  if (
    onCancelHandoff &&
    pending?.canCancel &&
    (pending.kind === "transfer" || pending.kind === "return")
  ) {
    const isReturn = pending.kind === "return";
    out.push({
      key: isReturn ? "cancelReturn" : "cancelTransfer",
      label: isReturn ? devicesCopy.actions.cancelReturn : devicesCopy.actions.cancelTransfer,
      ariaLabel: (isReturn
        ? devicesCopy.actions.cancelReturnAria
        : devicesCopy.actions.cancelTransferAria)(d.inventoryNumber),
      run: () => onCancelHandoff(d),
    });
  }
  if (onAssign && d.canAssign) {
    out.push({
      key: "assign",
      label: devicesCopy.actions.assign,
      ariaLabel: devicesCopy.actions.assignAria(d.inventoryNumber),
      run: () => onAssign(d, "assign"),
    });
  }
  if (onEditHolding && d.canEditHolding) {
    out.push({
      key: "editHolding",
      label: devicesCopy.actions.editHolding,
      ariaLabel: devicesCopy.actions.editHoldingAria(d.inventoryNumber),
      run: () => onEditHolding(d, "edit"),
    });
  }
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
  if (onTransfer && d.canTransfer) {
    out.push({
      key: "transfer",
      label: devicesCopy.actions.transfer,
      ariaLabel: devicesCopy.actions.transferAria(d.inventoryNumber),
      run: () => onTransfer(d),
    });
  }
  if (onReturn && d.canReturn) {
    out.push({
      key: "giveBack",
      label: devicesCopy.actions.giveBack,
      ariaLabel: devicesCopy.actions.giveBackAria(d.inventoryNumber),
      run: () => onReturn(d),
    });
  }
  if (onEdit && d.canEdit) {
    out.push({
      key: "edit",
      label: devicesCopy.actions.edit,
      ariaLabel: devicesCopy.actions.editAria(d.inventoryNumber),
      run: () => onEdit(d),
    });
  }
  if (onTakeBack && d.canTakeBack) {
    out.push({
      key: "takeBack",
      label: devicesCopy.actions.takeBack,
      ariaLabel: devicesCopy.actions.takeBackAria(d.inventoryNumber, d.owner?.displayName ?? ""),
      danger: true,
      run: () => onTakeBack(d),
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
  return busyId === d.id ? out.map((a) => ({ ...a, disabled: true })) : out;
}

export const hasAnyAction = (devices: DeviceDto[], h: DeviceRowHandlers): boolean =>
  devices.some((d) => rowActions(d, h).length > 0);
