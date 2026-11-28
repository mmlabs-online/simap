"use client";

import { useState } from "react";
import type { AvatarView } from "@/lib/sprites/avatar";
import type { PixelLook } from "@/lib/sprites/pixel-look";
import { Button } from "../Button";
import { Pill } from "../Chip";
import { portalCopy } from "../copy/portal";
import { Icon } from "../Icon";
import { SectionCard } from "../SectionCard";
import type { Atlas } from "../roomlayout/loadAtlas";
import { LookPreview } from "./LookPreview";
import { LookStage } from "./LookStage";
import { pickerOptions, type PixelLookKey } from "./pixel-look-state";

const copy = portalCopy.profile.character;

const swatchClass =
  "relative inline-flex min-h-control min-w-control cursor-pointer items-center justify-center rounded-md has-[:checked]:ring-2 has-[:checked]:ring-pixel-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-not-allowed";

const cardClass =
  "relative flex min-h-control min-w-control cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-divider bg-surface p-2 has-[:checked]:border-pixel-primary has-[:checked]:ring-2 has-[:checked]:ring-pixel-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-not-allowed";

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
  const [view, setView] = useState<AvatarView>("front");

  const group = (
    key: PixelLookKey,
    legend: string,
    items: { value: number; hex?: string; text?: string }[],
  ) => (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-label text-text-primary">{legend}</legend>
      <div className={key === "style" ? "grid grid-cols-3 gap-1" : "flex flex-wrap gap-1"}>
        {items.map((item, i) => {
          const checked = p.draft[key] === item.value;
          return (
            <label key={item.value} className={item.text ? cardClass : swatchClass}>
              <input
                type="radio"
                className="sr-only"
                name={`pixel-look-${key}`}
                value={item.value}
                checked={checked}
                disabled={locked}
                aria-label={item.text ? undefined : copy.option(legend, i + 1, items.length)}
                onChange={() => p.onChoose(key, item.value)}
              />
              {item.text ? (
                <>
                  {!p.atlasFailed && p.atlas && (
                    <LookPreview
                      atlas={p.atlas}
                      look={{ ...p.draft, style: item.value as PixelLook["style"] }}
                      view="front"
                      scale={1}
                      label={item.text}
                      decorative
                    />
                  )}
                  <span className="text-label font-normal text-text-primary">{item.text}</span>
                  {checked && (
                    <Icon
                      name="check"
                      size={16}
                      className="pointer-events-none absolute right-1 top-1 text-pixel-primary"
                    />
                  )}
                </>
              ) : (
                <>
                  <span
                    className="block size-8 rounded border border-divider"
                    style={{ background: item.hex }}
                  />
                  {checked && (
                    <Icon
                      name="check"
                      size={18}
                      className="pointer-events-none absolute text-on-action drop-shadow"
                    />
                  )}
                </>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <SectionCard
      headingId="pixel-look-heading"
      title={copy.heading}
      subtitle={copy.subtitle}
      titleAdornment={<Icon name="auto_awesome" size={18} className="text-pixel-primary" />}
      aside={<Pill tone="success" decorative label={copy.livePreview} />}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption text-text-secondary">{copy.tagline}</p>
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
        <LookStage
          atlas={p.atlas}
          atlasFailed={p.atlasFailed}
          look={p.draft}
          view={view}
          onViewChange={setView}
        />
        {p.isDerived && <p className="text-caption text-text-secondary">{copy.automatic}</p>}
        {p.status === "failed" && (
          <p className="text-caption text-text-secondary">{copy.loadFailed}</p>
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
