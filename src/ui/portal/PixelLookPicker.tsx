import type { AvatarView } from "@/lib/sprites/avatar";
import type { PixelLook } from "@/lib/sprites/pixel-look";
import { Button } from "../Button";
import { portalCopy } from "../copy/portal";
import type { Atlas } from "../roomlayout/loadAtlas";
import { LookPreview } from "./LookPreview";
import { pickerOptions, type PickerNotice, type PixelLookKey } from "./pixel-look-state";

const copy = portalCopy.profile.character;

const PREVIEWS: { view: AvatarView; scale: 1 | 2 }[] = [
  { view: "front", scale: 1 },
  { view: "back", scale: 1 },
  { view: "front", scale: 2 },
  { view: "back", scale: 2 },
];

const swatchClass =
  "inline-flex cursor-pointer items-center justify-center rounded-md p-0.5 has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary has-[:disabled]:cursor-default has-[:disabled]:opacity-60";

export type PixelLookPickerProps = {
  draft: PixelLook;
  isDerived: boolean;
  status: "loading" | "ready" | "failed";
  busy: "save" | "reset" | null;
  canSave: boolean;
  canReset: boolean;
  notice: PickerNotice | null;
  atlas: Atlas | null;
  atlasFailed: boolean;
  onChoose: (key: PixelLookKey, value: number) => void;
  onSave: () => void;
  onReset: () => void;
};

/** The pixel character picker: live previews, one radio group per layer, Save and Reset. Pure view. */
export function PixelLookPicker(p: PixelLookPickerProps) {
  const options = pickerOptions();
  const locked = p.busy !== null || p.status === "loading";

  const group = (
    key: PixelLookKey,
    legend: string,
    items: { value: number; hex?: string; text?: string }[],
  ) => (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-semibold text-on-surface-variant">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <label key={item.value} className={swatchClass}>
            <input
              type="radio"
              className="sr-only"
              name={`pixel-look-${key}`}
              value={item.value}
              checked={p.draft[key] === item.value}
              disabled={locked}
              aria-label={item.text ? undefined : copy.option(legend, i + 1, items.length)}
              onChange={() => p.onChoose(key, item.value)}
            />
            {item.text ? (
              <span className="px-2 py-1 text-sm text-on-surface">{item.text}</span>
            ) : (
              <span
                className="block h-7 w-7 rounded border border-outline-variant"
                style={{ background: item.hex }}
              />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <section aria-labelledby="pixel-look-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id="pixel-look-heading" className="text-base font-extrabold text-on-surface">
          {copy.heading}
        </h3>
        <p className="text-xs text-on-surface-variant">{copy.hint}</p>
      </div>
      {p.atlasFailed ? (
        <p className="text-xs text-on-surface-variant">{copy.previewUnavailable}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3" aria-busy={p.atlas ? undefined : true}>
          {PREVIEWS.map(({ view, scale }) => {
            const caption = `${copy.views[view]} ${scale}x`;
            return (
              <figure key={`${view}-${scale}`} className="m-0 flex flex-col items-center gap-1">
                <LookPreview
                  atlas={p.atlas}
                  look={p.draft}
                  view={view}
                  scale={scale}
                  label={copy.previewLabel(copy.views[view], scale)}
                />
                <figcaption className="text-xs text-on-surface-variant">{caption}</figcaption>
              </figure>
            );
          })}
        </div>
      )}
      {p.isDerived && <p className="text-xs text-on-surface-variant">{copy.automatic}</p>}
      <div className="flex flex-col gap-3" aria-busy={p.status === "loading" ? true : undefined}>
        {group(
          "skin",
          copy.layers.skin,
          options.skin.map((o) => ({ value: o.index, hex: o.hex })),
        )}
        {group(
          "hair",
          copy.layers.hair,
          options.hair.map((o) => ({ value: o.index, hex: o.hex })),
        )}
        {group(
          "style",
          copy.layers.style,
          options.style.map((n) => ({ value: n, text: copy.styleName(n) })),
        )}
        {group(
          "shirt",
          copy.layers.shirt,
          options.shirt.map((o) => ({ value: o.index, hex: o.hex })),
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!p.canSave} onClick={p.onSave}>
          {p.busy === "save" ? copy.saving : copy.save}
        </Button>
        <Button type="button" variant="tonal" disabled={!p.canReset} onClick={p.onReset}>
          {p.busy === "reset" ? copy.resetting : copy.reset}
        </Button>
      </div>
      {p.notice &&
        (p.notice.tone === "error" ? (
          <p role="alert" className="text-sm font-semibold text-error">
            {p.notice.text}
          </p>
        ) : (
          <p role="status" className="text-sm font-semibold text-on-surface">
            {p.notice.text}
          </p>
        ))}
    </section>
  );
}
