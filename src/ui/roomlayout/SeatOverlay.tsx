import type { SeatView } from "@/lib/sprites/layout";
import { STATUS_DOT, tagPlacement } from "@/lib/sprites/overlay";
import type { DrawList } from "@/lib/sprites/placement";
import { roomlayoutCopy } from "../copy/roomlayout";

const EMPTY: SeatView = { state: "empty", avatarSeed: null, name: null };

const SIDE = { above: "bottom-full mb-1", below: "top-full mt-1" } as const;
const ALIGN = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
} as const;

/** One real button per seat, in reading order, over the unscaled canvas. Name tags show on hover or focus only. */
export function SeatOverlay({
  list,
  views,
  zoom,
}: {
  list: DrawList;
  views: Readonly<Record<string, SeatView>>;
  zoom: number;
}) {
  const { bounds } = list;
  const widthPx = bounds.w * zoom;
  return (
    <>
      {list.seats.map((seat) => {
        const view = views[seat.id] ?? EMPTY;
        const left = (seat.x - bounds.x) * zoom;
        const top = (seat.y - bounds.y) * zoom;
        const tag = tagPlacement(seat.tileY, left + (seat.w * zoom) / 2, widthPx);
        const state = roomlayoutCopy.seatStates[view.state];
        return (
          <button
            key={seat.id}
            type="button"
            aria-label={roomlayoutCopy.seatLabel(seat.code, state, view.name)}
            className="group absolute cursor-pointer rounded-sm hover:outline-2 hover:outline-white focus-visible:outline-2 focus-visible:outline-white focus-visible:ring-2 focus-visible:ring-teal-500"
            style={{ left, top, width: seat.w * zoom, height: seat.h * zoom }}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute z-10 hidden max-w-40 items-center gap-1.5 rounded-full bg-[rgba(22,27,37,.92)] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white group-hover:flex group-focus-visible:flex ${SIDE[tag.side]} ${ALIGN[tag.align]}`}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_DOT[view.state] }}
              />
              <span>{seat.code}</span>
              {view.name ? <span className="truncate">{view.name}</span> : null}
            </span>
          </button>
        );
      })}
    </>
  );
}
