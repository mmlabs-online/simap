"use client";

import { useMemo, useRef, useState } from "react";
import type { DeviceDto, PlacementFilter } from "@/lib/devices/types";
import { atLeastTier } from "@/lib/tier";
import { useApiFetch } from "../auth/api-fetch-context";
import { createRoomsApi } from "../rooms/rooms-api";
import { createSeatsApi } from "../seats/seats-api";
import { useSession } from "../session";
import { DeleteDeviceDialog } from "./DeleteDeviceDialog";
import { DeviceFormDialog } from "./DeviceFormDialog";
import { PlaceDeviceDialog } from "./PlaceDeviceDialog";
import { DevicesView } from "./DevicesView";
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
  const session = useSession();
  const isAdmin = session ? atLeastTier(session.tier, "admin") : false;
  const [form, setForm] = useState<{ device: DeviceDto | null } | null>(null);
  const [deleting, setDeleting] = useState<DeviceDto | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { status, items, truncated, errorCode, reload, refresh } = useDevices(api, filter);
  const actions = useMemo<DeviceRowHandlers>(
    () => ({
      onPlace: (device, mode) => setPlacing({ device, mode }),
      onEdit: (device) => setForm({ device }),
      onDelete: (device) => setDeleting(device),
    }),
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
        onNew={() => setForm({ device: null })}
        headingRef={headingRef}
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
      <DeviceFormDialog
        open={form !== null}
        device={form?.device ?? null}
        isAdmin={isAdmin}
        api={api}
        loadPage={seatsApi.activeMembers}
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
