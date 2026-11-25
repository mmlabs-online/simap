import type { DeviceDto, HandoffDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import type { AssignMode } from "./assign-device";
import type { DeviceRowHandlers } from "./device-actions";
import type { DevicesResult } from "./devices-api";
import type { PlaceMode } from "./place-device";
import { takeBackDone } from "./return-device";
import { cancelOutcome } from "./transfer-device";

const done = devicesCopy.detail.done;

/** The one open dialog of the detail page; the device is a snapshot taken when it opened. */
export type DetailDialog =
  | { kind: "transfer" | "return" | "extend" | "takeBack"; device: DeviceDto }
  | { kind: "assign"; device: DeviceDto; mode: AssignMode }
  | { kind: "place"; device: DeviceDto; mode: PlaceMode };

/** What a dialog reports when it finishes: the dialog it was and the device it acted on. */
export type DetailDone = DetailDialog;

export type DeviceNotice = { tone: "status" | "error"; text: string };

/** The row handlers of the detail page: no Edit, no Delete. */
export const detailHandlers = (
  open: (dialog: DetailDialog) => void,
  onCancel: (device: DeviceDto) => void,
): DeviceRowHandlers => ({
  onAssign: (device, mode) => open({ kind: "assign", device, mode }),
  onEditHolding: (device, mode) => open({ kind: "assign", device, mode }),
  onPlace: (device, mode) => open({ kind: "place", device, mode }),
  onTransfer: (device) => open({ kind: "transfer", device }),
  onReturn: (device) => open({ kind: "return", device }),
  onExtend: (device) => open({ kind: "extend", device }),
  onTakeBack: (device) => open({ kind: "takeBack", device }),
  onCancelHandoff: onCancel,
});

/** The slot's device for a dialog of this kind, else null (that dialog stays closed). */
export const dialogFor = (dialog: DetailDialog | null, kind: DetailDialog["kind"]) =>
  dialog?.kind === kind ? dialog.device : null;

/** The notice after a dialog finished. */
export function doneNotice(d: DetailDone): DeviceNotice {
  const { name, inventoryNumber: inv } = d.device;
  const text = (() => {
    switch (d.kind) {
      case "transfer":
        return devicesCopy.transfer.sent(name, inv);
      case "return":
        return devicesCopy.giveBack.sent(name, inv);
      case "extend":
        return devicesCopy.extend.sent(name, inv);
      case "takeBack":
        return takeBackDone(d.device, "all");
      case "assign":
        return d.mode === "assign" ? done.assigned(name, inv) : done.holdingSaved(name, inv);
      case "place":
        return d.mode === "place"
          ? done.placed(name, inv)
          : d.mode === "move"
            ? done.moved(name, inv)
            : done.returnedToInventory(name, inv);
    }
  })();
  return { tone: "status", text };
}

/** `cancelOutcome`, with the detail page's own wording when the request is already gone. */
export function detailCancelOutcome(
  result: DevicesResult<HandoffDto>,
  device: Pick<DeviceDto, "name" | "inventoryNumber">,
  kind: "transfer" | "return" | "extension",
) {
  const outcome = cancelOutcome(result, device, kind);
  if (!result.ok && (result.code === "handoff_not_pending" || result.code === "not_found")) {
    return { ...outcome, notice: { tone: "status" as const, text: done.handoffGone } };
  }
  return outcome;
}

/** A refresh worked when both answers are ok; a deleted device (404) is shown as not found, not as a failure. */
export function refreshOk(detail: DevicesResult<unknown>, history: DevicesResult<unknown>) {
  if (!detail.ok && detail.code === "not_found") return true;
  return detail.ok && history.ok;
}

/** A failed refresh turns the notice into an error that also says the page is out of date. */
export function afterRefresh(notice: DeviceNotice | null, ok: boolean): DeviceNotice | null {
  if (ok) return notice;
  const text = notice ? `${notice.text} ${done.refreshFailed}` : done.refreshFailed;
  return { tone: "error", text };
}
