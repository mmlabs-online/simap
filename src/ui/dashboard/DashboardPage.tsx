"use client";

import { useMemo } from "react";
import { useApiFetch } from "../auth/api-fetch-context";
import { DashboardView } from "./DashboardView";
import { createDashboardApi } from "./dashboard-api";
import { useDashboard } from "./useDashboard";

/** Dashboard page: loads the live numbers on mount. Renders only below `AuthGate`. */
export function DashboardPage() {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createDashboardApi(apiFetch), [apiFetch]);
  const { status, data, errorCode, reload } = useDashboard(api);
  return (
    <DashboardView
      status={status}
      data={data}
      errorCode={errorCode}
      onRetry={() => void reload()}
    />
  );
}
