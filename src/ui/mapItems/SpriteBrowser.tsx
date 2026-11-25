import { frameTiles, sizeFor } from "@/lib/map-items/art";
import type { MapItemDto } from "@/lib/map-items/types";
import type { Direction } from "@/lib/sprites/types";
import { mapItemsCopy } from "../copy/mapItems";
import { Button } from "../Button";
import type { Atlas } from "../roomlayout/loadAtlas";
import { FramePreview } from "./FramePreview";
import { spriteChoices } from "./map-item-art";

const copy = mapItemsCopy.art.browser;

/** Inline chooser (thumbnails when an atlas is given) of package sprites for one direction. Pure: state and actions come from props. */
export function SpriteBrowser({
  item,
  dir,
  current,
  staged,
  busy,
  atlas,
  onStage,
  onUse,
  onCancel,
}: {
  item: MapItemDto;
  dir: Direction;
  current: string | null;
  staged: string | null;
  busy: boolean;
  atlas?: Atlas | null;
  onStage: (key: string) => void;
  onUse: () => void;
  onCancel: () => void;
}) {
  const label = mapItemsCopy.art.dirs[dir]!;
  const groups = spriteChoices(item, dir);
  const count = groups.reduce((n, g) => n + g.keys.length, 0);
  const [iw, ih] = sizeFor(dir, item.w, item.h);
  const [fw, fh] = staged ? frameTiles(staged) : [0, 0];
  return (
    <div role="group" aria-label={copy.label(label)} className="flex flex-col gap-2">
      <p role="status" className="text-xs font-medium text-on-surface-variant">
        {count === 0 ? copy.empty : copy.count(count)}
      </p>
      {count > 0 && (
        <div
          role="radiogroup"
          aria-label={copy.label(label)}
          className="flex max-h-56 flex-col gap-2 overflow-y-auto"
        >
          {groups.map((g) => (
            <div key={g.group} className="flex flex-col gap-1">
              <h4 className="text-xs font-extrabold uppercase text-on-surface-variant">
                {g.group}
              </h4>
              {g.keys.map((k) => {
                const [w, h] = frameTiles(k);
                return (
                  <label key={k} className="flex items-center gap-2 text-sm text-on-surface">
                    <input
                      type="radio"
                      name={`sprite-${dir}`}
                      value={k}
                      checked={(staged ?? current) === k}
                      disabled={busy}
                      onChange={() => onStage(k)}
                    />
                    {atlas && (
                      <FramePreview
                        atlas={atlas}
                        frameKey={k}
                        box={32}
                        label={mapItemsCopy.art.frameAlt(k)}
                      />
                    )}
                    <span className="font-mono text-xs">{k}</span>
                    <span className="text-xs text-on-surface-variant">{`${w} × ${h}`}</span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {staged && (
        <div className="flex flex-col gap-1 text-xs font-medium text-on-surface-variant">
          {atlas && (
            <FramePreview
              atlas={atlas}
              frameKey={staged}
              scale={1}
              label={mapItemsCopy.art.frameAlt(staged)}
            />
          )}
          <p>{copy.staged(staged)}</p>
          <p>{copy.tiles(fw, fh, iw, ih, label)}</p>
          {(fw < iw || fh < ih) && <p>{copy.smaller}</p>}
        </div>
      )}
      <div className="flex gap-2">
        {staged && (
          <Button size="sm" disabled={busy} onClick={onUse}>
            {copy.use}
          </Button>
        )}
        <Button variant="tonal" size="sm" disabled={busy} onClick={onCancel}>
          {copy.cancel}
        </Button>
      </div>
    </div>
  );
}
