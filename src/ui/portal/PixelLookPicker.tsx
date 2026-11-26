import type { AvatarView } from "@/lib/sprites/avatar";
import type { PixelLook } from "@/lib/sprites/pixel-look";
import { Button } from "../Button";
import { Pill } from "../Chip";
import { portalCopy } from "../copy/portal";
import { Icon } from "../Icon";
import { SectionCard } from "../SectionCard";
import type { Atlas } from "../roomlayout/loadAtlas";
import { LookPreview } from "./LookPreview";
import { pickerOptions, type PixelLookKey } from "./pixel-look-state";

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
  /** True while any save runs or the draft is loading: the radios and Reset are disabled. */
  locked: boolean;
  canReset: boolean;
  atlas: Atlas | null;
  atlasFailed: boolean;
  onChoose: (key: PixelLookKey, value: number) => void;
  onReset: () => void;
};

/** The pixel character picker: live previews, one radio group per layer and Reset (saved by the footer). Pure view. */
export function PixelLookPicker(p: PixelLookPickerProps) {
  const options = pickerOptions();
  const locked = p.locked;

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
    <SectionCard
      headingId="pixel-look-heading"
      title={copy.heading}
      subtitle={copy.subtitle}
      titleAdornment={<Icon name="auto_awesome" size={18} className="text-primary" />}
      aside={<Pill tone="success" decorative label={copy.livePreview} />}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant">{copy.tagline}</p>
          <Button
            type="button"
            variant="tonal"
            size="sm"
            icon="restart_alt"
            disabled={!p.canReset || locked}
            onClick={p.onReset}
          >
            {copy.reset}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
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
        <p className="text-xs text-on-surface-variant">{copy.mapsCaption}</p>
        {p.isDerived && <p className="text-xs text-on-surface-variant">{copy.automatic}</p>}
        {p.status === "failed" && (
          <p className="text-xs text-on-surface-variant">{copy.loadFailed}</p>
        )}
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
      </div>
    </SectionCard>
  );
}
