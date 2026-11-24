"use client";

import { useMemo, useState } from "react";
import type { DeviceDto, PlacementFilter } from "@/lib/devices/types";
import { useApiFetch } from "../auth/api-fetch-context";
import { createRoomsApi } from "../rooms/rooms-api";
import { createSeatsApi } from "../seats/seats-api";
import { PlaceDeviceDialog } from "./PlaceDeviceDialog";
import { DevicesView } from "./DevicesView";
import type { DeviceRowHandlers } from "./device-actions";
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
  const { status, items, truncated, errorCode, reload, refresh } = useDevices(api, filter);
  const actions = useMemo<DeviceRowHandlers>(
    () => ({ onPlace: (device, mode) => setPlacing({ device, mode }) }),
    [],
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
    </>
  );
}
