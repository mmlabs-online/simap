import type { DeviceDto } from "@/lib/devices/types";
import { Card } from "../Card";
import { devicesCopy } from "../copy/devices";
import { hasAnyAction, type DeviceRowHandlers } from "./device-actions";
import { DeviceNameLink, Details, Mac, OwnerLabel, PlacementLabel } from "./device-labels";
import { DeviceRowActions } from "./DeviceRowActions";

const CELL = "px-3 py-2 align-top text-sm text-on-surface";
const HEAD = "px-3 py-2 text-left text-[11px] font-extrabold uppercase text-on-surface-variant";

const COLUMNS = [
  "name",
  "type",
  "inventoryNumber",
  "mac",
  "details",
  "owner",
  "placement",
] as const;

/** Devices as a table at `md` and up and as a stacked list below, from one set of labels. Pure. */
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
      <div className="hidden md:block">
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">{devicesCopy.caption}</caption>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c} scope="col" className={HEAD}>
                    {devicesCopy.columns[c]}
                  </th>
                ))}
                {showActions && (
                  <th scope="col" className={HEAD}>
                    <span className="sr-only">{devicesCopy.columns.actions}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-t border-outline-variant">
                  <td className={`${CELL} font-semibold`}>
                    <DeviceNameLink device={d} />
                  </td>
                  <td className={CELL}>{d.type}</td>
                  <td className={CELL}>{d.inventoryNumber}</td>
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
                    <PlacementLabel device={d} />
                  </td>
                  {showActions && (
                    <td className={CELL}>
                      <DeviceRowActions device={d} handlers={actions} busyId={busyId} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <ul className="md:hidden flex flex-col gap-2">
        {devices.map((d) => (
          <li key={d.id}>
            <Card className="flex flex-col gap-1 p-3 text-sm text-on-surface">
              <span className="font-bold">
                <DeviceNameLink device={d} />
              </span>
              <span className="text-on-surface-variant">
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
