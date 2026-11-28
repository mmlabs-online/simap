"use client";

import { useRef } from "react";
import type { MapItemDto } from "@/lib/map-items/types";
import type { Direction } from "@/lib/sprites/types";
import { mapItemsCopy } from "../copy/mapItems";
import { Button } from "../Button";
import type { Atlas } from "../roomlayout/loadAtlas";
import { nextTabIndex } from "../tab-keys";
import { FramePreview } from "./FramePreview";
import { atlasFrame } from "./frame-preview";
import { SpriteBrowser } from "./SpriteBrowser";
import { artDirs, expectedImageSize, libraryFrameKey } from "./map-item-art";
import { effectiveArt, pendingItem, type EditorState } from "./map-item-editor";

const copy = mapItemsCopy.art;
const ed = mapItemsCopy.editor;
const CHANGED_DOT = "ml-1 inline-block size-1.5 rounded-full bg-pixel-primary align-middle";
const GRID: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(var(--color-divider) 1px, transparent 1px), linear-gradient(90deg, var(--color-divider) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
};

export type AppearanceProps = {
  item: MapItemDto;
  state: EditorState;
  busy: boolean;
  /** The URL of the item's saved custom image for a direction. */
  imageUrl: (dir: Direction) => string | null;
  atlas?: Atlas | null;
  atlasFailed?: boolean;
  onDir: (dir: Direction) => void;
  onSource: (source: "library" | "upload") => void;
  onPick: (key: string) => void;
  onQuery: (query: string) => void;
  onAllTypes: (allTypes: boolean) => void;
  onUpload: (dir: Direction, file: File) => void;
  onRestore: (dir: Direction) => void;
};

/** A radio group of buttons with arrow-key movement. */
function Radios<T extends string>({
  label,
  options,
  value,
  disabled,
  onSelect,
  className,
}: {
  label: string;
  options: { id: T; label: string; changed?: boolean }[];
  value: T;
  disabled: boolean;
  onSelect: (id: T) => void;
  className: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={className}>
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <Button
            key={o.id}
            variant="outlined"
            size="sm"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => onSelect(o.id)}
            onKeyDown={(e) => {
              const next = nextTabIndex(e.key, i, options.length);
              if (next === null) return;
              e.preventDefault();
              onSelect(options[next]!.id);
              ref.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
            }}
            className="flex-1 aria-checked:border-pixel-primary aria-checked:bg-tile aria-checked:font-semibold"
          >
            {on && <span aria-hidden="true">✓ </span>}
            {o.label}
            {o.changed && (
              <>
                <span aria-hidden="true" className={CHANGED_DOT} />
                <span className="sr-only"> {ed.changed}</span>
              </>
            )}
          </Button>
        );
      })}
    </div>
  );
}

/** The Appearance tab. Props only, so the markup can be tested without effects. */
export function MapItemEditorAppearance(p: AppearanceProps) {
  const { item, state, busy } = p;
  const dir = state.dir;
  const dirs = artDirs(item);
  const pending = pendingItem(item, state.form);
  const eff = effectiveArt(item, state, dir);
  const size = expectedImageSize(pending, dir);
  const dirLabel = copy.dirs[dir];
  const fileRef = useRef<HTMLInputElement>(null);
  const imgUrl = eff.stagedUrl ?? p.imageUrl(dir);
  const frameKey = eff.spriteKey ?? libraryFrameKey(item, dir);

  const render = (scale: 1 | 2) => {
    const scaleLabel = scale === 1 ? copy.scale1 : copy.scale2;
    if (eff.source === "image") {
      return imgUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgUrl}
          alt={`${dirLabel} ${scaleLabel}`}
          style={{ imageRendering: "pixelated", width: size.w * scale }}
        />
      ) : (
        <p className="text-caption font-medium text-text-secondary">{copy.previewNA}</p>
      );
    }
    if (!p.atlas) return null;
    return atlasFrame(p.atlas.manifest.frames, frameKey) ? (
      <FramePreview
        atlas={p.atlas}
        frameKey={frameKey!}
        scale={scale}
        label={copy.frameAlt(frameKey!, scaleLabel)}
      />
    ) : (
      <p className="text-caption font-medium text-text-secondary">{copy.previewNA}</p>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {p.atlasFailed && (
        <p role="status" className="text-caption font-semibold text-text-secondary">
          {copy.atlasFailed}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-label font-semibold text-text-primary">
          {item.directional ? ed.directional : copy.single}
        </h3>
        <span className="text-caption font-semibold text-text-secondary">
          {item.directional ? ed.neverRotated : copy.sameForAll}
        </span>
      </div>
      {item.directional && (
        <Radios
          label={ed.dirsLabel}
          value={dir}
          disabled={busy}
          onSelect={p.onDir}
          className="flex gap-2"
          options={dirs.map((d) => ({ id: d, label: copy.dirs[d], changed: !!state.art[d] }))}
        />
      )}

      <div
        className="relative flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-divider bg-tile p-4"
        style={GRID}
      >
        <span className="absolute top-2 left-2 rounded-full bg-canvas px-2 py-1 text-caption font-semibold text-text-primary">
          {eff.source === "image"
            ? copy.source.image
            : eff.source === "sprite"
              ? copy.source.sprite(eff.spriteKey!)
              : copy.source.library}
        </span>
        <div className="flex max-w-full items-end gap-6 overflow-x-auto">
          <figure className="m-0 flex flex-col items-center gap-1">
            {render(2)}
            <figcaption className="text-caption text-text-secondary">{copy.scale2}</figcaption>
          </figure>
          <figure className="m-0 flex flex-col items-center gap-1">
            {render(1)}
            <figcaption className="text-caption text-text-secondary">{copy.scale1}</figcaption>
          </figure>
        </div>
        <span
          aria-hidden="true"
          className="font-mono text-caption tracking-wide text-text-secondary"
        >
          {ed.previewCaption(dirLabel)}
        </span>
      </div>
      {eff.removedOnSave && (
        <p role="note" className="text-caption font-semibold text-danger">
          {ed.removedOnSave}
        </p>
      )}

      <Radios
        label={ed.sourceLabel}
        value={state.source}
        disabled={busy}
        onSelect={p.onSource}
        className="flex gap-2"
        options={[
          { id: "library", label: ed.sourceLibrary },
          { id: "upload", label: ed.sourceUpload },
        ]}
      />

      {state.source === "library" ? (
        <SpriteBrowser
          item={pending}
          dir={dir}
          selected={eff.source === "sprite" ? eff.spriteKey : null}
          query={state.query}
          allTypes={state.allTypes}
          busy={busy}
          atlas={p.atlas}
          onPick={p.onPick}
          onQuery={p.onQuery}
          onAllTypes={p.onAllTypes}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-caption font-medium text-text-secondary">
            {copy.size(size.w, size.hMin, size.hMax)}
          </p>
          <div>
            <Button
              variant="tonal"
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {ed.choosePng}
            </Button>
            <input
              type="file"
              accept="image/png"
              hidden
              ref={fileRef}
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) p.onUpload(dir, file);
              }}
            />
          </div>
        </div>
      )}

      {state.dirNotes[dir] && (
        <p role="alert" className="text-label font-semibold text-danger">
          {state.dirNotes[dir]}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {item.directional && (
          <p className="text-caption font-medium text-text-secondary">{ed.onlyUpdates(dirLabel)}</p>
        )}
        <Button
          variant="outlined"
          size="sm"
          disabled={busy || (eff.source === "library" && !eff.staged)}
          onClick={() => p.onRestore(dir)}
        >
          {ed.restore}
        </Button>
      </div>
    </div>
  );
}
