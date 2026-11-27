import { frameTiles, sizeFor } from "@/lib/map-items/art";
import type { MapItemDto } from "@/lib/map-items/types";
import { bundledKeys } from "@/lib/sprites/bundled";
import type { Direction } from "@/lib/sprites/types";
import { mapItemsCopy } from "../copy/mapItems";
import type { Atlas } from "../roomlayout/loadAtlas";
import { FramePreview } from "./FramePreview";
import { browserChoices } from "./map-item-art";

const copy = mapItemsCopy.art.browser;
const editorCopy = mapItemsCopy.editor;

/** Staging picker of package sprites for one direction: picking a tile stages it at once. Pure: state and actions come from props. */
export function SpriteBrowser({
  item,
  dir,
  selected,
  query,
  allTypes,
  busy,
  atlas,
  onPick,
  onQuery,
  onAllTypes,
}: {
  /** The item with its pending size. */
  item: MapItemDto;
  dir: Direction;
  selected: string | null;
  query: string;
  allTypes: boolean;
  busy: boolean;
  atlas?: Atlas | null;
  onPick: (key: string) => void;
  onQuery: (query: string) => void;
  onAllTypes: (allTypes: boolean) => void;
}) {
  const label = mapItemsCopy.art.dirs[dir]!;
  const { title, groups, count } = browserChoices(item, dir, bundledKeys(atlas?.manifest), {
    allTypes,
    query,
  });
  const [iw, ih] = sizeFor(dir, item.w, item.h);
  const smaller = groups.some((g) =>
    g.keys.some((k) => {
      const [w, h] = frameTiles(k);
      return w < iw || h < ih;
    }),
  );
  return (
    <div role="group" aria-label={copy.label(label)} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label={editorCopy.searchLabel}
          placeholder={editorCopy.search}
          value={query}
          disabled={busy}
          onChange={(e) => onQuery(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-md3 border border-outline-variant bg-surface px-3 text-sm font-medium text-on-surface"
        />
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-on-surface">
          <input
            type="checkbox"
            checked={allTypes}
            disabled={busy}
            onChange={(e) => onAllTypes(e.target.checked)}
          />
          {editorCopy.allTypes}
        </label>
      </div>
      <p role="status" className="text-xs font-medium text-on-surface-variant">
        {title ? `${title} · ` : ""}
        {count === 0 ? (query.trim() ? editorCopy.noMatch : copy.empty) : copy.count(count)}
      </p>
      {smaller && <p className="text-xs text-on-surface-variant">{copy.smaller}</p>}
      {count > 0 && (
        <div
          role="radiogroup"
          aria-label={copy.label(label)}
          className="flex max-h-64 flex-col gap-3 overflow-y-auto"
        >
          {groups.map((g) => (
            <div key={g.group} className="flex flex-col gap-1">
              <h4 className="text-xs font-extrabold uppercase text-on-surface-variant">
                {g.group}
              </h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {g.keys.map((k) => {
                  const [w, h] = frameTiles(k);
                  return (
                    <label
                      key={k}
                      className="relative flex min-h-11 cursor-pointer flex-col items-center gap-1 rounded-md3 border border-outline-variant bg-surface p-2 has-[:checked]:border-primary has-[:checked]:bg-primary-container"
                    >
                      <input
                        type="radio"
                        name={`sprite-${dir}`}
                        value={k}
                        checked={selected === k}
                        disabled={busy}
                        onChange={() => onPick(k)}
                        className="peer sr-only"
                      />
                      <span className="pointer-events-none absolute inset-0 rounded-md3 peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
                      {atlas && (
                        <FramePreview
                          atlas={atlas}
                          frameKey={k}
                          box={32}
                          label={mapItemsCopy.art.frameAlt(k)}
                        />
                      )}
                      <span className="break-all text-center font-mono text-[11px] text-on-surface">
                        {k}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">{`${w} × ${h}`}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
