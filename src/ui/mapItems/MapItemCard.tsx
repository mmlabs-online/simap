import type { MapItemDto } from "@/lib/map-items/types";
import { mapItemsCopy } from "../copy/mapItems";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { Pill } from "../Chip";
import type { Atlas } from "../roomlayout/loadAtlas";
import { FramePreview } from "./FramePreview";
import { libraryFrameKey, thumbSprite } from "./map-item-art";
import { artSourceOf } from "./map-items-state";

const TILE_GRID = {
  backgroundImage:
    "linear-gradient(var(--color-divider) 1px, transparent 1px), linear-gradient(90deg, var(--color-divider) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
} as const;

const DECORATIVE = "";
const { list, card } = mapItemsCopy;

/** One catalog item: art preview, size, name, library key, group and the edit pencil. Pure. */
export function MapItemCard({
  item,
  thumbUrl,
  atlas,
  onEdit,
}: {
  item: MapItemDto;
  thumbUrl?: (item: MapItemDto) => string | null;
  atlas?: Atlas | null;
  onEdit: (item: MapItemDto) => void;
}) {
  const url = thumbUrl?.(item) ?? null;
  const frameKey = thumbSprite(item) ?? libraryFrameKey(item, "s");
  const art = url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={DECORATIVE}
      className="size-24 object-contain"
      style={{ imageRendering: "pixelated" }}
    />
  ) : atlas && frameKey ? (
    <FramePreview atlas={atlas} frameKey={frameKey} box={96} label={item.name} />
  ) : null;
  return (
    <Card as="article" className="flex min-w-0 flex-col">
      <div className="relative">
        <div
          aria-hidden="true"
          className="flex h-36 items-center justify-center overflow-hidden rounded-t-xl bg-tile sm:h-40"
          style={TILE_GRID}
        >
          <span className={item.hidden ? "opacity-60" : undefined}>{art}</span>
        </div>
        <span className="absolute left-2 top-2 rounded-md border border-divider bg-surface px-2 font-mono text-caption text-text-secondary">
          <span aria-hidden="true">{card.size(item.w, item.h)}</span>
          <span className="sr-only">{card.sizeLabel(item.w, item.h)}</span>
        </span>
        <button
          type="button"
          aria-label={mapItemsCopy.editLabel(item.name)}
          onClick={() => onEdit(item)}
          className="state-layer absolute bottom-1 right-1 inline-flex size-control cursor-pointer items-center justify-center rounded-full"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-full border border-divider bg-surface text-text-secondary">
            <Icon name="edit" size={16} />
          </span>
        </button>
      </div>
      <div className="flex min-w-0 flex-col gap-1 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <h3
            className="min-w-0 truncate text-label font-semibold text-text-primary"
            title={item.name}
          >
            {item.name}
          </h3>
          {item.hidden && <Pill tone="warning" label={list.hidden} />}
        </div>
        <p className="truncate font-mono text-caption text-text-secondary" title={item.builtinKey}>
          {item.builtinKey}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-md bg-tile px-2 text-caption font-medium text-text-pixel">
            {item.group}
          </span>
          {item.fixedSize && <span className="text-caption text-text-secondary">{list.fixed}</span>}
          <span className="ml-auto text-caption text-text-secondary">
            {card.source[artSourceOf(item)]}
          </span>
        </div>
      </div>
    </Card>
  );
}
