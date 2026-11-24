"use client";

import { useCallback, useMemo, useState } from "react";
import { EXPORT_MAX_ROWS, type ExportKind } from "@/lib/export/csv";
import { atLeastTier } from "@/lib/tier";
import { useApiFetch } from "../auth/api-fetch-context";
import { dashboardCopy } from "../copy/dashboard";
import { useSession } from "../session";
import { DashboardView } from "./DashboardView";
import { createDashboardApi } from "./dashboard-api";
import { createExportApi } from "./export-api";
import { saveBlob } from "./save-blob";
import { useDashboard } from "./useDashboard";

/** Dashboard page: loads the live numbers on mount. Renders only below `AuthGate`. */
export function DashboardPage() {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createDashboardApi(apiFetch), [apiFetch]);
  const exportApi = useMemo(() => createExportApi(apiFetch), [apiFetch]);
  const session = useSession();
  const canExport = session ? atLeastTier(session.tier, "manager") : false;
  const { status, data, errorCode, reload } = useDashboard(api);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const onExport = useCallback(
    async (kind: ExportKind) => {
      setExporting(kind);
      setExportError(null);
      setExportNotice(null);
      const r = await exportApi.download(kind);
      if (r.ok) {
        saveBlob(r.blob, r.filename);
        if (r.truncated) setExportNotice(dashboardCopy.export.truncated(EXPORT_MAX_ROWS));
      } else {
        setExportError(r.code);
      }
      setExporting(null);
    },
    [exportApi],
  );

  return (
    <DashboardView
      status={status}
      data={data}
      errorCode={errorCode}
      onRetry={() => void reload()}
      canExport={canExport}
      exporting={exporting}
      exportError={exportError}
      exportNotice={exportNotice}
      onExport={(kind) => void onExport(kind)}
    />
  );
}
