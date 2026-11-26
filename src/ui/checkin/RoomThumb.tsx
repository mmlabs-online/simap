import type { RoomThumb } from "@/lib/sprites/room-thumb";

const FILL: Record<RoomThumb["cells"][number]["kind"], string> = {
  floor: "var(--px-floor)",
  fixture: "var(--px-outline)",
  seat: "var(--px-wall)",
  mine: "var(--px-accent)",
};

/** A 64x40 pixel mini-map of a room; a wall band over floor when there is no layout. Decorative. */
export function RoomThumbView({ thumb }: { thumb: RoomThumb | null }) {
  return (
    <svg
      viewBox={thumb ? `0 0 ${thumb.w} ${thumb.h}` : "0 0 8 5"}
      width={64}
      height={40}
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="flex-none border-2 border-px-outline"
    >
      {thumb ? (
        thumb.cells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} fill={FILL[c.kind]} />
        ))
      ) : (
        <>
          <rect x={0} y={0} width={8} height={5} fill="var(--px-floor)" />
          <rect x={0} y={0} width={8} height={2} fill="var(--px-wall)" />
        </>
      )}
    </svg>
  );
}
