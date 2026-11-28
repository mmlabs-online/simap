import type { SeatPresence } from "@/lib/presence/seat-presence";
import type { SeatView } from "@/lib/sprites/layout";
import { STATUS_DOT, tagPlacement } from "@/lib/sprites/overlay";
import type { DrawList } from "@/lib/sprites/placement";
import { layoutTags, openTagRect, TAG_H, type PlacedTag } from "@/lib/sprites/tag-layout";
import { roomlayoutCopy } from "../copy/roomlayout";

const EMPTY: SeatView = { state: "empty", avatarSeed: null, name: null, look: null };

const SIDE = { above: "bottom-full mb-1", below: "top-full mt-1" } as const;
const ALIGN = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
} as const;

const TAG_BASE =
  "pointer-events-none absolute items-center gap-1 rounded-full px-3 py-1 text-caption font-semibold whitespace-nowrap";
const TAG_LOOK: Record<SeatPresence, string> = {
  present: "bg-text-primary text-surface",
  away: "bg-tile text-text-secondary",
};
const TAG_NEUTRAL = "bg-tile text-text-primary";

/** The always-visible name tag (D80): a filled dot when present, a hollow ring when away, so the state is a shape and a word, not colour. */
function NameTag({
  placed,
  name,
  presence,
}: {
  placed: PlacedTag;
  name: string;
  presence: SeatPresence | undefined;
}) {
  const look = presence ? TAG_LOOK[presence] : TAG_NEUTRAL;
  // Before the first presence answer there is no marker: unknown is not "present".
  const marker =
    presence === "present" ? (
      <span data-marker="dot" className="size-2 shrink-0 rounded-full bg-current" />
    ) : presence === "away" ? (
      <span data-marker="ring" className="size-2 shrink-0 rounded-full border-2 border-current" />
    ) : null;
  if (placed.kind === "dot") {
    return (
      <span
        aria-hidden="true"
        data-presence={presence}
        className={`${TAG_BASE} z-10 flex justify-center ${look}`}
        style={{
          left: placed.left,
          top: placed.top,
          width: placed.width,
          height: placed.width,
          padding: 0,
        }}
      >
        {marker}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-presence={presence}
      className={`${TAG_BASE} z-10 flex ${look}`}
      style={{ left: placed.left, top: placed.top, width: placed.width, height: TAG_H }}
    >
      {marker}
      <span className={placed.truncated ? "truncate" : undefined}>{name}</span>
    </span>
  );
}

/**
 * One real button per seat, in reading order, over the unscaled canvas. By default name tags show on hover or focus
 * only (D50). With `tags="always"` (the presence view, D80) occupied seats also carry a visible, non-overlapping tag,
 * and `openTags` adds a "Move here" button on the member's other desks (D77).
 */
export function SeatOverlay({
  list,
  views,
  zoom,
  onSelect,
  tags = "hover",
  presence,
  openTags = [],
  onOpenTag,
  openTagsBusy = false,
}: {
  list: DrawList;
  views: Readonly<Record<string, SeatView>>;
  zoom: number;
  onSelect?: (seatCode: string) => void;
  tags?: "hover" | "always";
  presence?: Readonly<Record<string, SeatPresence>>;
  /** Seat ids that show an open tag. */
  openTags?: readonly string[];
  onOpenTag?: (seatId: string) => void;
  openTagsBusy?: boolean;
}) {
  const { bounds } = list;
  const widthPx = bounds.w * zoom;
  const always = tags === "always";
  const rect = (seat: DrawList["seats"][number]) => ({
    left: (seat.x - bounds.x) * zoom,
    top: (seat.y - bounds.y) * zoom,
    w: seat.w * zoom,
    h: seat.h * zoom,
  });

  const area = { w: widthPx, h: bounds.h * zoom };
  const open = always
    ? list.seats
        .filter((s) => openTags.includes(s.id))
        .map((s) => ({
          seat: s,
          rect: openTagRect(rect(s), area, roomlayoutCopy.presence.moveHere),
        }))
    : [];
  const placed = new Map<string, PlacedTag>();
  if (always) {
    const named = list.seats.filter((s) => (views[s.id] ?? EMPTY).avatarSeed !== null);
    const result = layoutTags({
      seats: named.map((s) => ({
        id: s.id,
        ...rect(s),
        text: (views[s.id] ?? EMPTY).name ?? roomlayoutCopy.presence.unnamed,
      })),
      area,
      obstacles: open.map((o) => o.rect),
    });
    for (const p of result) placed.set(p.id, p);
  }

  return (
    <>
      {list.seats.map((seat) => {
        const view = views[seat.id] ?? EMPTY;
        const box = rect(seat);
        const tag = tagPlacement(seat.tileY, box.left + box.w / 2, widthPx);
        const state = roomlayoutCopy.seatStates[view.state];
        const seatPresence = always ? presence?.[seat.id] : undefined;
        const at = placed.get(seat.id);
        const label = seatPresence
          ? roomlayoutCopy.presence.seatLabel(seat.code, state, view.name, seatPresence)
          : roomlayoutCopy.seatLabel(seat.code, state, view.name);
        // The hover/focus tag of a placed seat sits where the visible tag is and shows the full name.
        const hoverPos =
          at && at.kind === "tag" ? { left: at.left - box.left, top: at.top - box.top } : null;
        return (
          <button
            key={seat.id}
            type="button"
            data-map-seat={seat.code}
            aria-haspopup="dialog"
            onClick={() => onSelect?.(seat.code)}
            aria-label={label}
            className="group absolute cursor-pointer rounded-sm hover:outline-2 hover:outline-surface"
            style={{ left: box.left, top: box.top, width: box.w, height: box.h }}
          >
            <span
              aria-hidden="true"
              className={
                hoverPos
                  ? "pointer-events-none absolute z-20 hidden items-center gap-1 rounded-full bg-text-primary px-3 py-1 text-caption font-semibold whitespace-nowrap text-surface group-hover:flex group-focus-visible:flex"
                  : `pointer-events-none absolute z-10 hidden ${always ? "" : "max-w-40 "}items-center gap-1 rounded-full bg-text-primary px-3 py-1 text-caption font-semibold whitespace-nowrap text-surface group-hover:flex group-focus-visible:flex ${SIDE[tag.side]} ${ALIGN[tag.align]}`
              }
              style={hoverPos ?? undefined}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_DOT[view.state] }}
              />
              <span>{seat.code}</span>
              {view.name ? (
                <span className={always ? undefined : "truncate"}>{view.name}</span>
              ) : null}
            </span>
          </button>
        );
      })}
      {always &&
        list.seats.map((seat) => {
          const at = placed.get(seat.id);
          if (!at) return null;
          const view = views[seat.id] ?? EMPTY;
          return (
            <NameTag
              key={`tag:${seat.id}`}
              placed={at}
              name={view.name ?? roomlayoutCopy.presence.unnamed}
              presence={presence?.[seat.id]}
            />
          );
        })}
      {open.map(({ seat, rect: r }) => (
        <button
          key={`open:${seat.id}`}
          type="button"
          data-open-tag={seat.code}
          aria-label={roomlayoutCopy.presence.moveHereLabel(seat.code)}
          disabled={openTagsBusy}
          onClick={() => onOpenTag?.(seat.id)}
          className="absolute z-30 min-h-6 cursor-pointer rounded-full bg-pixel-primary px-3 text-caption font-semibold whitespace-nowrap text-on-action shadow-card before:absolute before:inset-x-0 before:top-1/2 before:h-control before:-translate-y-1/2 disabled:cursor-wait disabled:opacity-50"
          style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
        >
          {roomlayoutCopy.presence.moveHere}
        </button>
      ))}
    </>
  );
}
