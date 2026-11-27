import type { DeviceDto } from "@/lib/devices/types";
import { Button } from "../Button";
import { Card } from "../Card";
import { Pill } from "../Chip";
import { devicesCopy } from "../copy/devices";
import type { DeviceRowHandlers } from "./device-actions";
import { DeviceRowActions } from "./DeviceRowActions";
import { pendingText } from "./devices-state";

const copy = devicesCopy.overdueBanner;
const MAX_ROWS = 5;

export type OverdueBannerProps = {
  devices: DeviceDto[];
  truncated: boolean;
  handlers: DeviceRowHandlers;
  busyId: string | null;
  onShowAll: () => void;
};

/** The owner's reminder: my overdue devices with Extend and Give back. Pure. Renders nothing when there are none. */
export function OverdueBanner({
  devices,
  truncated,
  handlers,
  busyId,
  onShowAll,
}: OverdueBannerProps) {
  const mine = devices.filter((d) => d.mine && d.overdue);
  if (mine.length === 0) return null;
  const rows = mine.slice(0, MAX_ROWS);
  return (
    <section aria-labelledby="overdue-heading" className="flex flex-col gap-3">
      <h2 id="overdue-heading" className="text-subtitle text-text-primary">
        {copy.heading(mine.length)}
      </h2>
      <p className="text-label font-normal text-text-secondary">{copy.hint}</p>
      <ul role="list" className="flex flex-col gap-2">
        {rows.map((d) => {
          const pending = pendingText(d);
          return (
            <li key={d.id}>
              <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-label font-normal text-text-primary">
                    <span className="font-semibold">{d.name}</span>{" "}
                    {devicesCopy.typeLine(d.type, d.inventoryNumber)}
                  </p>
                  <p className="inline-flex flex-wrap items-center gap-1 text-label font-normal text-text-secondary">
                    {d.holding && (
                      <span>{devicesCopy.holding.expired(d.holding.expiresOn ?? "")}</span>
                    )}
                    {pending && <Pill dot tone="warning" label={pending.chip} />}
                  </p>
                  {pending?.to && <p className="text-caption text-text-secondary">{pending.to}</p>}
                </div>
                <DeviceRowActions device={d} handlers={handlers} busyId={busyId} />
              </Card>
            </li>
          );
        })}
      </ul>
      {(mine.length > MAX_ROWS || truncated) && (
        <div>
          <Button variant="tonal" size="sm" onClick={onShowAll}>
            {copy.showAll}
          </Button>
        </div>
      )}
    </section>
  );
}
