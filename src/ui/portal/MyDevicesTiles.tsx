import type { DeviceDto } from "@/lib/devices/types";
import type { IconName } from "@/lib/icons";
import { Card } from "../Card";
import { portalCopy } from "../copy/portal";
import { Icon } from "../Icon";
import { tileValue, typeIcon, typeSummary } from "./my-devices-filter";

const TONES = ["bg-canvas text-text-primary", "bg-info-tint text-info"];

function Tile({
  icon,
  tone,
  value,
  label,
}: {
  icon: IconName;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <li>
      <Card className="flex items-center gap-4 p-5">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon name={icon} size={24} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-title text-text-primary">{value}</span>
          <span title={label} className="truncate text-label font-normal text-text-secondary">
            {label}
          </span>
        </span>
      </Card>
    </li>
  );
}

/** Summary tiles over the loaded devices: the total, then one per type. Pure. */
export function MyDevicesTiles({ devices, hasMore }: { devices: DeviceDto[]; hasMore: boolean }) {
  const copy = portalCopy.devices;
  const fmt = (n: number) => tileValue(n, hasMore, copy.atLeast);
  return (
    <ul
      role="list"
      aria-label={copy.tilesLabel}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Tile
        icon="category"
        tone="bg-workspace-action text-on-action"
        value={fmt(devices.length)}
        label={copy.totalTile}
      />
      {typeSummary(devices).map((t, i) => (
        <Tile
          key={t.key}
          icon={typeIcon(t.label)}
          tone={TONES[i % TONES.length]!}
          value={fmt(t.count)}
          label={t.label}
        />
      ))}
    </ul>
  );
}
