import type { RoomsApi } from "../rooms/rooms-api";
import type { SeatsApi } from "../seats/seats-api";
import { AssignDeviceDialog } from "./AssignDeviceDialog";
import { ExtendDeviceDialog } from "./ExtendDeviceDialog";
import { PlaceDeviceDialog } from "./PlaceDeviceDialog";
import { ReturnDeviceDialog } from "./ReturnDeviceDialog";
import { TakeBackDeviceDialog } from "./TakeBackDeviceDialog";
import { TransferDeviceDialog } from "./TransferDeviceDialog";
import { dialogFor, type DetailDialog, type DetailDone } from "./device-detail-actions";
import type { DevicesApi } from "./devices-api";

type Props = {
  dialog: DetailDialog | null;
  api: DevicesApi;
  seatsApi: SeatsApi;
  roomsApi: RoomsApi;
  onClose: () => void;
  onStale: () => void;
  onDone: (done: DetailDone) => void;
};

/** The six action dialogs of the device pages, driven by one slot. Each reports back the slot's kind, mode and device. */
export function DeviceDetailDialogs({
  dialog,
  api,
  seatsApi,
  roomsApi,
  onClose,
  onStale,
  onDone,
}: Props) {
  const common = { onClose, onStale };
  // The dialogs that return the device they acted on report that one; the others report the slot's.
  const withDevice = (kind: "transfer" | "return" | "extend" | "takeBack") => ({
    ...common,
    onDone: (device: DetailDone["device"]) => onDone({ kind, device }),
  });
  return (
    <>
      <TransferDeviceDialog
        device={dialogFor(dialog, "transfer")}
        devicesApi={api}
        seatsApi={seatsApi}
        {...withDevice("transfer")}
      />
      <ReturnDeviceDialog
        device={dialogFor(dialog, "return")}
        devicesApi={api}
        {...withDevice("return")}
      />
      <ExtendDeviceDialog
        device={dialogFor(dialog, "extend")}
        devicesApi={api}
        {...withDevice("extend")}
      />
      <TakeBackDeviceDialog
        device={dialogFor(dialog, "takeBack")}
        api={api}
        {...withDevice("takeBack")}
      />
      <PlaceDeviceDialog
        open={dialog?.kind === "place"}
        device={dialogFor(dialog, "place")}
        mode={dialog?.kind === "place" ? dialog.mode : "place"}
        devicesApi={api}
        roomsApi={roomsApi}
        seatsApi={seatsApi}
        {...common}
        onDone={() => dialog?.kind === "place" && onDone(dialog)}
      />
      <AssignDeviceDialog
        open={dialog?.kind === "assign"}
        device={dialogFor(dialog, "assign")}
        mode={dialog?.kind === "assign" ? dialog.mode : "assign"}
        devicesApi={api}
        seatsApi={seatsApi}
        {...common}
        onDone={() => dialog?.kind === "assign" && onDone(dialog)}
      />
    </>
  );
}
