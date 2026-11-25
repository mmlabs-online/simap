import type { DeviceKind } from "@/lib/device-types/types";
import { DIAGRAM, slotMarker } from "./device-types-state";

/** A small top-down desk (two tiles, the seat below it) with a dot where the kind's first device sits. Decorative. */
export function DeskSlotDiagram({ kind }: { kind: DeviceKind }) {
  const m = slotMarker(kind);
  const { w, h, deskX, deskY, tile, deskH } = DIAGRAM;
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${w} ${h}`}
      className="w-40 shrink-0 text-on-surface-variant"
    >
      <rect
        x={deskX}
        y={deskY}
        width={tile * 2}
        height={deskH}
        rx={3}
        className="fill-surface-container-high stroke-outline-variant"
      />
      <line
        x1={deskX + tile}
        y1={deskY}
        x2={deskX + tile}
        y2={deskY + deskH}
        className="stroke-outline-variant"
      />
      <rect
        x={w / 2 - 10}
        y={deskY + deskH + 6}
        width={20}
        height={8}
        rx={4}
        className="fill-outline-variant"
      />
      <circle
        cx={m.x}
        cy={m.y}
        r={5}
        className={m.under ? "fill-none stroke-primary" : "fill-primary"}
        strokeDasharray={m.under ? "2 2" : undefined}
      />
    </svg>
  );
}
