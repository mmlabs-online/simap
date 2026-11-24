"use client";

import { useMemo, useState } from "react";
import type { PlacementFilter } from "@/lib/devices/types";
import { useApiFetch } from "../auth/api-fetch-context";
import { DevicesView } from "./DevicesView";
import { createDevicesApi } from "./devices-api";
import { useDevices } from "./useDevices";

/** Devices page: loads the list for the chosen filter. Renders only below `AuthGate`. */
export function DevicesPage() {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createDevicesApi(apiFetch), [apiFetch]);
  const [filter, setFilter] = useState<PlacementFilter>("all");
  const { status, items, truncated, errorCode, reload } = useDevices(api, filter);

  return (
    <DevicesView
      status={status}
      devices={items}
      truncated={truncated}
      errorCode={errorCode}
      filter={filter}
      onFilter={setFilter}
      onRetry={() => void reload()}
    />
  );
}
