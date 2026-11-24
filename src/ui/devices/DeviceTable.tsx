import Link from "next/link";
import type { DeviceDto } from "@/lib/devices/types";
import { roomDetailHref } from "@/lib/nav";
import { Card } from "../Card";
import { Chip } from "../Chip";
import { devicesCopy } from "../copy/devices";
import { placementText } from "./devices-state";

const CELL = "px-3 py-2 align-top text-sm text-on-surface";
const HEAD = "px-3 py-2 text-left text-[11px] font-extrabold uppercase text-on-surface-variant";

function PlacementLabel({ device }: { device: DeviceDto }) {
  const p = device.placement;
  if (!p) return <span className="text-on-surface-variant">{devicesCopy.inInventory}</span>;
  const href = roomDetailHref(p.roomCode);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {href ? (
        <Link href={href} className="font-semibold text-primary underline">
          {placementText(p)}
        </Link>
      ) : (
        <span>{placementText(p)}</span>
      )}
      <Chip label={devicesCopy.roles[p.role]} />
    </span>
  );
}

function OwnerLabel({ device }: { device: DeviceDto }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{device.owner.displayName}</span>
      {device.mine && <Chip label={devicesCopy.you} />}
    </span>
  );
}

function Mac({ mac }: { mac: string | null }) {
  return mac ? <span className="font-mono">{mac}</span> : <span>{devicesCopy.noMac}</span>;
}

const COLUMNS = ["name", "type", "inventoryNumber", "mac", "owner", "placement"] as const;

/** Devices as a table at `md` and up and as a stacked list below, from one set of labels. Pure. */
export function DeviceTable({ devices }: { devices: DeviceDto[] }) {
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
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-t border-outline-variant">
                  <td className={`${CELL} font-semibold`}>{d.name}</td>
                  <td className={CELL}>{d.type}</td>
                  <td className={CELL}>{d.inventoryNumber}</td>
                  <td className={CELL}>
                    <Mac mac={d.mac} />
                  </td>
                  <td className={CELL}>
                    <OwnerLabel device={d} />
                  </td>
                  <td className={CELL}>
                    <PlacementLabel device={d} />
                  </td>
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
              <span className="font-bold">{d.name}</span>
              <span className="text-on-surface-variant">
                {devicesCopy.typeLine(d.type, d.inventoryNumber)}
              </span>
              <OwnerLabel device={d} />
              <PlacementLabel device={d} />
              <Mac mac={d.mac} />
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
