import { DEVICE_LIMITS, type DeviceDto, type PlacementFilter } from "@/lib/devices/types";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { shellCopy } from "../copy/shell";
import { Button } from "../Button";
import { Card } from "../Card";
import { FilterChips } from "../Chip";
import { DeviceTable } from "./DeviceTable";
import type { DeviceRowHandlers } from "./device-actions";
import { emptyText, filterOptions, listSummary } from "./devices-state";

export type DevicesViewProps = {
  status: "loading" | "error" | "ready";
  devices: DeviceDto[];
  truncated: boolean;
  errorCode: string | null;
  filter: PlacementFilter;
  onFilter: (filter: PlacementFilter) => void;
  onRetry: () => void;
  actions?: DeviceRowHandlers;
  onNew?: () => void;
};

/** The Devices page body. Pure: data and handlers come from props. */
export function DevicesView({
  status,
  devices,
  truncated,
  errorCode,
  filter,
  onFilter,
  onRetry,
  actions,
  onNew,
}: DevicesViewProps) {
  return (
    <div className="p-4 lg:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h2 font-extrabold text-on-surface">{shellCopy.pages.devices.title}</h1>
        {onNew && (
          <Button icon="add" onClick={onNew}>
            {devicesCopy.newDevice}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          options={filterOptions()}
          value={filter}
          onChange={onFilter}
          ariaLabel={devicesCopy.filterLabel}
        />
        <p aria-live="polite" className="text-sm text-on-surface-variant">
          {status === "ready" ? listSummary(devices.length, filter) : null}
        </p>
      </div>

      {status === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-12 animate-pulse">
              {null}
            </Card>
          ))}
        </div>
      )}

      {status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-sm font-semibold text-error">
            {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {devicesCopy.retry}
          </Button>
        </Card>
      )}

      {status === "ready" && devices.length === 0 && (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-sm font-medium text-on-surface-variant">{emptyText(filter)}</p>
          {filter !== "all" && (
            <Button variant="tonal" size="sm" onClick={() => onFilter("all")}>
              {devicesCopy.showAll}
            </Button>
          )}
        </Card>
      )}

      {status === "ready" && truncated && (
        <p className="text-sm text-on-surface-variant">
          {devicesCopy.truncated(DEVICE_LIMITS.list)}
        </p>
      )}

      {status === "ready" && devices.length > 0 && (
        <DeviceTable devices={devices} actions={actions} />
      )}
    </div>
  );
}
