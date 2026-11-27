import type { MapItemDto } from "@/lib/map-items/types";
import { apiErrorMessage } from "../copy/api";
import { groupsCopy } from "../copy/groups";
import { mapItemsCopy } from "../copy/mapItems";
import { shellCopy } from "../copy/shell";
import { Button } from "../Button";
import { Card } from "../Card";
import type { ListState } from "../groups/ListSection";
import type { Atlas } from "../roomlayout/loadAtlas";
import { FramePreview } from "./FramePreview";
import { isCustomised, thumbSprite } from "./map-item-art";
import { catalogGroups } from "./map-items-state";

export type MapItemsViewProps = {
  access: "ok" | "forbidden";
  items: ListState<MapItemDto>;
  onEdit: (item: MapItemDto) => void;
  /** The blob URL of the row thumbnail (a custom image), or null. */
  thumbUrl?: (item: MapItemDto) => string | null;
  /** The sprite atlas, for the thumbnail of items that only have a package sprite. */
  atlas?: Atlas | null;
  onRetry: () => void;
};

const BADGE =
  "shrink-0 rounded-full border border-outline-variant px-2 py-0.5 text-xs font-bold text-on-surface-variant";

/** The Map items page body. Pure: data and handlers come from props. */
export function MapItemsView({
  access,
  items,
  onEdit,
  thumbUrl,
  atlas,
  onRetry,
}: MapItemsViewProps) {
  const title = (
    <h1 className="text-h2 font-extrabold text-on-surface">{shellCopy.pages.mapItems.title}</h1>
  );
  if (access === "forbidden") {
    return (
      <div className="p-4 lg:p-6 flex flex-col gap-4">
        {title}
        <Card className="px-6 py-12 text-center">
          <p role="alert" className="text-sm font-medium text-on-surface-variant">
            {mapItemsCopy.noAccess}
          </p>
        </Card>
      </div>
    );
  }
  return (
    <div className="p-4 lg:p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        {title}
        <p className="text-sm font-medium text-on-surface-variant">{mapItemsCopy.intro}</p>
      </div>

      {items.status === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Card key={i} className="h-14 animate-pulse">
              {null}
            </Card>
          ))}
        </div>
      )}

      {items.status === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-sm font-semibold text-error">
            {apiErrorMessage(items.errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {groupsCopy.retry}
          </Button>
        </Card>
      )}

      {items.status === "ready" && items.items.length === 0 && (
        <Card className="px-6 py-8 text-center">
          <p className="text-sm font-medium text-on-surface-variant">{mapItemsCopy.list.empty}</p>
        </Card>
      )}

      {items.status === "ready" &&
        catalogGroups(items.items).map(({ group, items: rows }) => (
          <section key={group} className="flex flex-col gap-3">
            <h2 className="text-h3 font-extrabold text-on-surface">{group}</h2>
            <ul className="flex flex-col gap-2">
              {rows.map((item) => (
                <li key={item.builtinKey}>
                  <Card className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0 flex-wrap">
                      {thumbUrl?.(item) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbUrl(item)!}
                          alt={mapItemsCopy.art.thumbAlt(item.name)}
                          className="size-8 shrink-0 object-contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      )}
                      {!thumbUrl?.(item) && atlas && thumbSprite(item) && (
                        <FramePreview
                          atlas={atlas}
                          frameKey={thumbSprite(item)!}
                          box={32}
                          label={mapItemsCopy.art.thumbAlt(item.name)}
                        />
                      )}
                      <span className="truncate text-sm font-bold text-on-surface">
                        {item.name}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-on-surface-variant">
                        {item.builtinKey}
                      </span>
                      <span className={BADGE}>{`${item.w} × ${item.h}`}</span>
                      {item.hidden && <span className={BADGE}>{mapItemsCopy.list.hidden}</span>}
                      {item.fixedSize && <span className={BADGE}>{mapItemsCopy.list.fixed}</span>}
                      {isCustomised(item) && (
                        <span className={BADGE}>{mapItemsCopy.list.customised}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="tonal"
                        size="sm"
                        icon="edit"
                        aria-label={mapItemsCopy.editLabel(item.name)}
                        onClick={() => onEdit(item)}
                      >
                        {mapItemsCopy.edit}
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
