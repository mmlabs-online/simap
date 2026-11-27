import type { DeviceDto } from "@/lib/devices/types";
import { Card } from "../Card";
import { devicesCopy } from "../copy/devices";
import { hasAnyAction, type DeviceRowHandlers } from "./device-actions";
import { DeviceNameLink, Details, Mac, OwnerLabel, PlacementLabel } from "./device-labels";
import { DeviceRowActions } from "./DeviceRowActions";
import { TABLE_CELL, TABLE_HEAD, TABLE_ROW } from "../table";

const COLUMNS = [
  "name",
  "type",
  "inventoryNumber",
  "mac",
  "details",
  "owner",
  "placement",
] as const;

/** Devices as a table at `lg` (1024 px) and up and as a stacked list below, from one set of labels. Pure. */
export function DeviceTable({
  devices,
  actions = {},
  busyId = null,
}: {
  devices: DeviceDto[];
  actions?: DeviceRowHandlers;
  busyId?: string | null;
}) {
  const showActions = hasAnyAction(devices, actions);
  return (
    <>
      <div className="hidden lg:block">
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">{devicesCopy.caption}</caption>
            <thead>
              <tr className="border-b border-divider">
                {COLUMNS.map((c) => (
                  <th key={c} scope="col" className={TABLE_HEAD}>
                    {devicesCopy.columns[c]}
                  </th>
                ))}
                {showActions && (
                  <th scope="col" className={TABLE_HEAD}>
                    <span className="sr-only">{devicesCopy.columns.actions}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className={TABLE_ROW}>
                  <td className={TABLE_CELL}>
                    <DeviceNameLink device={d} />
                  </td>
                  <td className={TABLE_CELL}>{d.type}</td>
                  <td className={TABLE_CELL}>{d.inventoryNumber}</td>
                  <td className={TABLE_CELL}>
                    <Mac mac={d.mac} />
                  </td>
                  <td className={TABLE_CELL}>
                    <Details device={d} />
                  </td>
                  <td className={TABLE_CELL}>
                    <OwnerLabel device={d} />
                  </td>
                  <td className={TABLE_CELL}>
                    <PlacementLabel device={d} />
                  </td>
                  {showActions && (
                    <td className={TABLE_CELL}>
                      <DeviceRowActions device={d} handlers={actions} busyId={busyId} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <ul className="flex flex-col gap-2 lg:hidden">
        {devices.map((d) => (
          <li key={d.id}>
            <Card className="flex flex-col gap-1 p-3 text-label font-normal text-text-primary">
              <span className="font-semibold">
                <DeviceNameLink device={d} />
              </span>
              <span className="text-text-secondary">
                {devicesCopy.typeLine(d.type, d.inventoryNumber)}
              </span>
              <OwnerLabel device={d} clamp="line-clamp-2" />
              <PlacementLabel device={d} />
              <Mac mac={d.mac} />
              <Details device={d} />
              <DeviceRowActions device={d} handlers={actions} busyId={busyId} />
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
