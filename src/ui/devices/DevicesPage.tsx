"use client";

import { useMemo, useRef, useState } from "react";
import type { DeviceDto, PlacementFilter } from "@/lib/devices/types";
import { atLeastTier } from "@/lib/tier";
import { useApiFetch } from "../auth/api-fetch-context";
import { createRoomsApi } from "../rooms/rooms-api";
import { createSeatsApi } from "../seats/seats-api";
import { useSession } from "../session";
import type { AssignMode } from "./assign-device";
import { AssignDeviceDialog } from "./AssignDeviceDialog";
import { DeleteDeviceDialog } from "./DeleteDeviceDialog";
import { DeviceFormDialog } from "./DeviceFormDialog";
import { PlaceDeviceDialog } from "./PlaceDeviceDialog";
import { devicesCopy } from "../copy/devices";
import { DevicesView, type DevicesViewProps } from "./DevicesView";
import { TransferDeviceDialog } from "./TransferDeviceDialog";
import { cancelOutcome } from "./transfer-device";
import type { DeviceRowHandlers } from "./device-actions";
import { filterAfterCreate } from "./device-form";
import { createDevicesApi } from "./devices-api";
import type { PlaceMode } from "./place-device";
import { useDevices } from "./useDevices";

/** Devices page: loads the list for the chosen filter. Renders only below `AuthGate`. */
export function DevicesPage() {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createDevicesApi(apiFetch), [apiFetch]);
  const roomsApi = useMemo(() => createRoomsApi(apiFetch), [apiFetch]);
  const seatsApi = useMemo(() => createSeatsApi(apiFetch), [apiFetch]);
  const [filter, setFilter] = useState<PlacementFilter>("all");
  const [placing, setPlacing] = useState<{ device: DeviceDto; mode: PlaceMode } | null>(null);
  const [holding, setHolding] = useState<{ device: DeviceDto; mode: AssignMode } | null>(null);
  const session = useSession();
  const isAdmin = session ? atLeastTier(session.tier, "admin") : false;
  const [form, setForm] = useState<{ device: DeviceDto | null } | null>(null);
  const [deleting, setDeleting] = useState<DeviceDto | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { status, items, truncated, errorCode, reload, refresh } = useDevices(api, filter);
  const [transferring, setTransferring] = useState<DeviceDto | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const cancelling = useRef(false);
  const [notice, setNotice] = useState<DevicesViewProps["notice"]>(null);
  const actions = useMemo<DeviceRowHandlers>(
    () => ({
      onAssign: (device, mode) => {
        setNotice(null);
        setHolding({ device, mode });
      },
      onEditHolding: (device, mode) => {
        setNotice(null);
        setHolding({ device, mode });
      },
      onPlace: (device, mode) => {
        setNotice(null);
        setPlacing({ device, mode });
      },
      onEdit: (device) => {
        setNotice(null);
        setForm({ device });
      },
      onDelete: (device) => {
        setNotice(null);
        setDeleting(device);
      },
      onTransfer: (device) => {
        setNotice(null);
        setTransferring(device);
      },
      onCancelTransfer: async (device) => {
        const pending = device.pendingHandoff;
        if (cancelling.current || !pending) return;
        cancelling.current = true;
        setCancellingId(device.id);
        setNotice(null);
        const outcome = cancelOutcome(await api.cancelHandoff(pending.id), device);
        setNotice(outcome.notice);
        if (outcome.refresh) await refresh();
        cancelling.current = false;
        setCancellingId(null);
        headingRef.current?.focus();
      },
    }),
    [api, refresh],
  );

  return (
    <>
      <DevicesView
        status={status}
        devices={items}
        truncated={truncated}
        errorCode={errorCode}
        filter={filter}
        onFilter={setFilter}
        onRetry={() => void reload()}
        actions={actions}
        onNew={isAdmin ? () => setForm({ device: null }) : undefined}
        headingRef={headingRef}
        busyId={cancellingId}
        notice={notice}
      />
      <TransferDeviceDialog
        device={transferring}
        devicesApi={api}
        seatsApi={seatsApi}
        onClose={() => setTransferring(null)}
        onStale={() => void refresh()}
        onDone={(device) => {
          setTransferring(null);
          setNotice({
            tone: "status",
            text: devicesCopy.transfer.sent(device.name, device.inventoryNumber),
          });
          void refresh().then(() => headingRef.current?.focus());
        }}
      />
      <PlaceDeviceDialog
        open={placing !== null}
        device={placing?.device ?? null}
        mode={placing?.mode ?? "place"}
        devicesApi={api}
        roomsApi={roomsApi}
        seatsApi={seatsApi}
        onClose={() => setPlacing(null)}
        onStale={() => void refresh()}
        onDone={() => {
          setPlacing(null);
          void refresh();
        }}
      />
      <AssignDeviceDialog
        open={holding !== null}
        device={holding?.device ?? null}
        mode={holding?.mode ?? "assign"}
        devicesApi={api}
        seatsApi={seatsApi}
        onClose={() => setHolding(null)}
        onStale={() => void refresh()}
        onDone={(mode) => {
          setHolding(null);
          const done = refresh();
          // An assigned row leaves the filter or swaps its button; an edited row keeps its button.
          if (mode === "assign") void done.then(() => headingRef.current?.focus());
        }}
      />
      <DeviceFormDialog
        open={form !== null}
        device={form?.device ?? null}
        api={api}
        onClose={() => setForm(null)}
        onDone={() => {
          const created = form?.device === null;
          const next = created ? filterAfterCreate(filter) : filter;
          setForm(null);
          if (next !== filter) setFilter(next);
          else void refresh();
        }}
      />
      <DeleteDeviceDialog
        device={deleting}
        api={api}
        onClose={() => setDeleting(null)}
        onStale={() => void refresh()}
        onDone={() => {
          setDeleting(null);
          void refresh().then(() => headingRef.current?.focus());
        }}
      />
    </>
  );
}
