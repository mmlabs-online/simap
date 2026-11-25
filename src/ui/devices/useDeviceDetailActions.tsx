"use client";

import { useMemo, useRef, useState } from "react";
import type { DeviceDto } from "@/lib/devices/types";
import type { RoomsApi } from "../rooms/rooms-api";
import type { SeatsApi } from "../seats/seats-api";
import { AssignDeviceDialog } from "./AssignDeviceDialog";
import { ExtendDeviceDialog } from "./ExtendDeviceDialog";
import { PlaceDeviceDialog } from "./PlaceDeviceDialog";
import { ReturnDeviceDialog } from "./ReturnDeviceDialog";
import { TakeBackDeviceDialog } from "./TakeBackDeviceDialog";
import { TransferDeviceDialog } from "./TransferDeviceDialog";
import {
  detailHandlers,
  doneNotice,
  finishAction,
  type DetailDialog,
  type Notice,
} from "./device-detail-actions";
import type { DevicesApi } from "./devices-api";
import { cancelOutcome } from "./transfer-device";
import type { RefreshFn } from "./useDeviceDetail";
import { useSetHandoffBadge } from "./useHandoffBadge";

/**
 * Dialog host for the device detail page. It repeats the wiring of `DevicesPage` on purpose (plan A1); a shared host is a follow-up.
 */
export function useDeviceDetailActions({
  api,
  roomsApi,
  seatsApi,
  refresh,
  requestFocus,
}: {
  api: DevicesApi;
  roomsApi: RoomsApi;
  seatsApi: SeatsApi;
  refresh: RefreshFn;
  requestFocus: () => void;
}) {
  const [open, setOpen] = useState<DetailDialog | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const acting = useRef(false);
  const setBadge = useSetHandoffBadge();

  /** Refreshes the device and its history and the nav badge. */
  const refreshAll: RefreshFn = async () => {
    const [r, count] = await Promise.all([refresh(), api.handoffCount()]);
    if (count.ok) setBadge(count.value);
    return r;
  };

  const settle = async (device: DeviceDto, n: Notice | null, withRefresh: boolean) => {
    await finishAction({
      notice: n,
      refresh: withRefresh ? refreshAll : null,
      setNotice,
      requestFocus,
    });
    acting.current = false;
    setBusyId((id) => (id === device.id ? null : id));
  };

  const done = (d: DetailDialog) => {
    setOpen(null);
    if (acting.current) return;
    acting.current = true;
    setBusyId(d.device.id);
    void settle(d.device, doneNotice(d), true);
  };

  const cancel = async (device: DeviceDto) => {
    const pending = device.pendingHandoff;
    if (acting.current || !pending) return;
    acting.current = true;
    setBusyId(device.id);
    setNotice(null);
    const outcome = cancelOutcome(await api.cancelHandoff(pending.id), device, pending.kind);
    await settle(device, outcome.notice, outcome.refresh);
  };

  const handlers = useMemo(
    () =>
      detailHandlers(
        (d) => {
          setNotice(null);
          setOpen(d);
        },
        (device) => void cancel(device),
      ),
    // `cancel` reads only these inputs and refs; the handlers must not change identity on every render.
    [api, refresh, requestFocus, setBadge],
  );

  const onStale = () => void refreshAll();
  const of = <K extends DetailDialog["kind"]>(kind: K) =>
    open?.kind === kind ? (open as Extract<DetailDialog, { kind: K }>) : null;
  const placing = of("place");
  const holding = of("assign");

  const dialogs = (
    <>
      <TransferDeviceDialog
        device={of("transfer")?.device ?? null}
        devicesApi={api}
        seatsApi={seatsApi}
        onClose={() => setOpen(null)}
        onStale={onStale}
        onDone={() => open && done(open)}
      />
      <ReturnDeviceDialog
        device={of("return")?.device ?? null}
        devicesApi={api}
        onClose={() => setOpen(null)}
        onStale={onStale}
        onDone={() => open && done(open)}
      />
      <ExtendDeviceDialog
        device={of("extend")?.device ?? null}
        devicesApi={api}
        onClose={() => setOpen(null)}
        onStale={onStale}
        onDone={() => open && done(open)}
      />
      <TakeBackDeviceDialog
        device={of("takeBack")?.device ?? null}
        api={api}
        onClose={() => setOpen(null)}
        onStale={onStale}
        onDone={() => open && done(open)}
      />
      <PlaceDeviceDialog
        open={placing !== null}
        device={placing?.device ?? null}
        mode={placing?.mode ?? "place"}
        devicesApi={api}
        roomsApi={roomsApi}
        seatsApi={seatsApi}
        onClose={() => setOpen(null)}
        onStale={onStale}
        onDone={() => open && done(open)}
      />
      <AssignDeviceDialog
        open={holding !== null}
        device={holding?.device ?? null}
        mode={holding?.mode ?? "assign"}
        devicesApi={api}
        seatsApi={seatsApi}
        onClose={() => setOpen(null)}
        onStale={onStale}
        onDone={() => open && done(open)}
      />
    </>
  );

  return { handlers, busyId, notice, dialogs };
}
