import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import type { AssignMode } from "./assign-device";
import type { DeviceRowHandlers } from "./device-actions";
import type { PlaceMode } from "./place-device";
import { takeBackDone } from "./return-device";
import type { RefreshResult } from "./useDeviceDetail";

export type Notice = { tone: "status" | "error"; text: string };

export type DetailDialog =
  | { kind: "transfer"; device: DeviceDto }
  | { kind: "return"; device: DeviceDto }
  | { kind: "extend"; device: DeviceDto }
  | { kind: "takeBack"; device: DeviceDto }
  | { kind: "place"; device: DeviceDto; mode: PlaceMode }
  | { kind: "assign"; device: DeviceDto; mode: AssignMode };

/** The handlers the detail page offers: everything but Edit and Delete, which stay on the list. */
export function detailHandlers(
  open: (d: DetailDialog) => void,
  cancel: (device: DeviceDto) => void,
): DeviceRowHandlers {
  return {
    onTransfer: (device) => open({ kind: "transfer", device }),
    onReturn: (device) => open({ kind: "return", device }),
    onExtend: (device) => open({ kind: "extend", device }),
    onTakeBack: (device) => open({ kind: "takeBack", device }),
    onPlace: (device, mode) => open({ kind: "place", device, mode }),
    onAssign: (device, mode) => open({ kind: "assign", device, mode }),
    onEditHolding: (device, mode) => open({ kind: "assign", device, mode }),
    onCancelHandoff: cancel,
  };
}

/** The success notice after a dialog finished. */
export function doneNotice(d: DetailDialog): Notice {
  const { name, inventoryNumber: inv } = d.device;
  const done = devicesCopy.detail.done;
  const text =
    d.kind === "transfer"
      ? devicesCopy.transfer.sent(name, inv)
      : d.kind === "return"
        ? devicesCopy.giveBack.sent(name, inv)
        : d.kind === "extend"
          ? devicesCopy.extend.sent(name, inv)
          : d.kind === "takeBack"
            ? takeBackDone(d.device, "all")
            : d.kind === "place"
              ? done.placement(name, inv)
              : d.mode === "assign"
                ? done.assigned(name, inv)
                : done.holdingSaved(name, inv);
  return { tone: "status", text };
}

/**
 * Shows the notice first, then refreshes, then asks for focus. A 404 on refresh clears the notice (the device is gone);
 * any other refresh failure replaces it with an error.
 */
export async function finishAction(deps: {
  notice: Notice | null;
  refresh: (() => Promise<RefreshResult>) | null;
  setNotice: (n: Notice | null) => void;
  requestFocus: () => void;
}): Promise<void> {
  deps.setNotice(deps.notice);
  if (deps.refresh) {
    const r = await deps.refresh();
    if (!r.ok) {
      deps.setNotice(
        r.code === "not_found" ? null : { tone: "error", text: devicesCopy.detail.refreshFailed },
      );
    }
  }
  deps.requestFocus();
}
