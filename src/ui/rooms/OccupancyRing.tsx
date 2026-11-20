import { occupancyPercent, ringDash } from "@/lib/rooms/occupancy";
import { roomsCopy } from "../copy/rooms";

const RADIUS = 20;

/** Plain SVG ring of the occupied share of a room's seats. */
export function OccupancyRing({ occupied, total }: { occupied: number; total: number }) {
  const percent = occupancyPercent(occupied, total);
  const { circumference, offset } = ringDash(percent, RADIUS);
  return (
    <div className="relative size-14 flex-none">
      <svg
        viewBox="0 0 48 48"
        className="size-full -rotate-90"
        role="img"
        aria-label={roomsCopy.occupancyLabel(occupied, total)}
      >
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          strokeWidth="5"
          className="stroke-outline-variant"
        />
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-primary"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-on-surface"
      >
        {roomsCopy.percent(percent)}
      </span>
    </div>
  );
}
