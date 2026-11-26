import type { DeviceDto } from "@/lib/devices/types";
import { Button } from "../Button";
import { Pill } from "../Chip";
import { apiErrorMessage } from "../copy/api";
import { devicesCopy } from "../copy/devices";
import { portalCopy } from "../copy/portal";
import { hasAnyAction, type DeviceRowHandlers } from "../devices/device-actions";
import { DeviceNameLink, Details, Mac, OwnerLabel, PlacementLabel } from "../devices/device-labels";
import { DeviceRowActions } from "../devices/DeviceRowActions";
import { FilledInput } from "../FilledInput";
import { Icon } from "../Icon";
import { SectionCard } from "../SectionCard";
import {
  effectiveType,
  filterDevices,
  tileValue,
  typeIcon,
  typeSummary,
} from "./my-devices-filter";

const CELL = "px-4 py-4 align-top text-sm text-on-surface";
const HEAD = "px-4 py-3 text-left text-[11px] font-extrabold uppercase text-on-surface-variant";
const COLUMNS = [
  "name",
  "type",
  "inventoryNumber",
  "mac",
  "details",
  "owner",
  "placement",
] as const;
const TYPE_SELECT_ID = "my-devices-type";

export type MyDevicesTableProps = {
  devices: DeviceDto[];
  hasMore: boolean;
  loadingMore: boolean;
  /** Load-more error code; the footer alert shows when set. */
  errorCode: string | null;
  actions: DeviceRowHandlers;
  busyId: string | null;
  query: string;
  typeKey: string;
  onQueryChange: (q: string) => void;
  onTypeChange: (key: string) => void;
  onClear: () => void;
  onLoadMore: () => void;
};

/** The "Your assigned devices" card: search, type filter, one scrollable table and a footer. Pure. */
export function MyDevicesTable({
  devices,
  hasMore,
  loadingMore,
  errorCode,
  actions,
  busyId,
  query,
  typeKey,
  onQueryChange,
  onTypeChange,
  onClear,
  onLoadMore,
}: MyDevicesTableProps) {
  const copy = portalCopy.devices;
  const options = typeSummary(devices);
  const type = effectiveType(options, typeKey);
  const rows = filterDevices(devices, query, type);
  const showActions = hasAnyAction(devices, actions);
  const cols = showActions ? 8 : 7;
  return (
    <SectionCard
      headingId="my-devices-card"
      title={copy.cardTitle}
      subtitle={copy.cardSubtitle}
      titleAdornment={
        <Pill tone="neutral" label={tileValue(devices.length, hasMore, copy.atLeast)} />
      }
      flush
      aside={
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <FilledInput
            type="search"
            icon="search"
            aria-label={copy.searchLabel}
            placeholder={copy.searchPlaceholder}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="h-10! w-full sm:w-56"
          />
          <label htmlFor={TYPE_SELECT_ID} className="sr-only">
            {copy.typeLabel}
          </label>
          <select
            id={TYPE_SELECT_ID}
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
            className="h-10 min-w-0 rounded-md3 border border-outline-variant bg-surface px-3 text-sm font-semibold text-on-surface"
          >
            <option value="">{copy.allTypes}</option>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-variant">
          <p role="status">
            {(hasMore ? copy.showingLoaded : copy.showing)(rows.length, devices.length)}
          </p>
          <span className="lg:hidden">{copy.scrollHint}</span>
          {errorCode !== null && (
            <p role="alert" className="font-semibold text-error">
              {copy.loadMoreFailed} {apiErrorMessage(errorCode)}
            </p>
          )}
          {hasMore && (
            <Button variant="tonal" size="sm" disabled={loadingMore} onClick={onLoadMore}>
              {copy.loadMore}
            </Button>
          )}
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse">
          <caption className="sr-only">{copy.tableCaption}</caption>
          <thead>
            <tr className="bg-surface-container">
              {COLUMNS.map((c) => (
                <th key={c} scope="col" className={HEAD}>
                  {devicesCopy.columns[c]}
                </th>
              ))}
              {showActions && (
                <th scope="col" className={HEAD}>
                  {devicesCopy.columns.actions}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-outline-variant">
                <td className={`${CELL} font-semibold`}>
                  <span className="inline-flex items-center gap-2">
                    <Icon name={typeIcon(d.type)} size={20} className="text-on-surface-variant" />
                    <DeviceNameLink device={d} />
                  </span>
                </td>
                <td className={CELL}>{d.type}</td>
                <td className={`${CELL} font-mono`}>{d.inventoryNumber}</td>
                <td className={CELL}>
                  <Mac mac={d.mac} />
                </td>
                <td className={CELL}>
                  <Details device={d} />
                </td>
                <td className={CELL}>
                  <OwnerLabel device={d} />
                </td>
                <td className={CELL}>
                  <PlacementLabel device={d} inventoryLabel={copy.inMyInventory} />
                </td>
                {showActions && (
                  <td className={CELL}>
                    <DeviceRowActions device={d} handlers={actions} busyId={busyId} />
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className="border-t border-outline-variant">
                <td colSpan={cols} className={`${CELL} text-center`}>
                  <span className="inline-flex flex-wrap items-center justify-center gap-3">
                    <span className="text-on-surface-variant">{copy.noMatches}</span>
                    <Button variant="tonal" size="sm" type="button" onClick={onClear}>
                      {copy.clearFilters}
                    </Button>
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
