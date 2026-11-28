"use client";

import { libraryItem } from "@/lib/map-items/library";
import { MAP_ITEM_DIRS, MAP_ITEM_LIMITS, type MapItemDto } from "@/lib/map-items/types";
import { mapItemsCopy } from "../copy/mapItems";
import { Button } from "../Button";
import { DialogField, DialogSelect } from "../EntityFormDialog";
import { resizeEffects, type MapItemForm } from "./map-item-form";
import { isLibraryDefault } from "./map-items-state";

const copy = mapItemsCopy.form;
const resetCopy = mapItemsCopy.reset;
const ed = mapItemsCopy.editor;
const CAPTION = "text-label text-text-primary";
const HINT = "text-caption font-medium text-text-secondary";
const SIZES = Array.from(
  { length: MAP_ITEM_LIMITS.sizeMax - MAP_ITEM_LIMITS.sizeMin + 1 },
  (_, i) => MAP_ITEM_LIMITS.sizeMin + i,
);

/** The reset confirm text. Props only, so the markup can be tested without effects. */
export function ResetMapItemBody({ item }: { item: MapItemDto }) {
  const lib = libraryItem(item.builtinKey);
  if (!lib) return null;
  const images = MAP_ITEM_DIRS.filter((d) => item.art[d].hasImage).length;
  const sizeChanges = lib.w !== item.w || lib.h !== item.h;
  return (
    <div className="flex flex-col gap-2 text-label text-text-primary">
      <p>{resetCopy.intro(item.name)}</p>
      <ul className="list-disc pl-5">
        <li>{resetCopy.name(lib.name)}</li>
        <li>{resetCopy.group(lib.group)}</li>
        <li>{resetCopy.size(`${lib.w} × ${lib.h}`)}</li>
        <li>{resetCopy.shown}</li>
      </ul>
      <p>
        {images > 0 ? `${resetCopy.images(images)} ` : ""}
        {resetCopy.sprites}
      </p>
      {sizeChanges && <p className="text-text-secondary">{resetCopy.inUseNote}</p>}
    </div>
  );
}

export type DetailsProps = {
  item: MapItemDto;
  form: MapItemForm;
  /** Existing group names, offered as suggestions. */
  groups: readonly string[];
  busy: boolean;
  /** Unsaved changes exist (the reset confirm warns). */
  dirty: boolean;
  confirmingReset: boolean;
  onChange: (patch: Partial<MapItemForm>) => void;
  onAskReset: () => void;
  onKeepEditing: () => void;
  onReset: () => void;
};

/** The Details tab. Props only, so the markup can be tested without effects. */
export function MapItemEditorDetails(p: DetailsProps) {
  const { item, form, busy } = p;
  const fx = resizeEffects(item, form.w, form.h);
  const listId = `map-item-groups-${item.builtinKey}`;
  const sizeSelect = (axis: "w" | "h", label: string) => (
    <DialogSelect
      label={label}
      icon="grid_view"
      value={item.fixedSize ? item[axis] : form[axis]}
      disabled={busy || item.fixedSize}
      onChange={(e) => p.onChange({ [axis]: Number(e.target.value) })}
    >
      {SIZES.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </DialogSelect>
  );
  return (
    <div className="flex flex-col gap-4">
      <p className={HINT}>
        <span className="font-mono">{item.builtinKey}</span> · {copy.keyNote}
      </p>
      <DialogField
        label={copy.name}
        icon="edit"
        value={form.name}
        disabled={busy}
        onChange={(e) => p.onChange({ name: e.target.value })}
        maxLength={MAP_ITEM_LIMITS.name}
        autoComplete="off"
        required
      />
      <DialogField
        label={copy.group}
        icon="category"
        value={form.group}
        disabled={busy}
        onChange={(e) => p.onChange({ group: e.target.value })}
        maxLength={MAP_ITEM_LIMITS.group}
        list={listId}
        autoComplete="off"
        required
      />
      <datalist id={listId}>
        {p.groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <fieldset className="flex flex-col gap-2">
        <legend className={CAPTION}>{copy.size}</legend>
        <div className="grid grid-cols-2 gap-3">
          {sizeSelect("w", copy.width)}
          {sizeSelect("h", copy.height)}
        </div>
        <p className="text-label font-semibold text-text-primary">
          {item.fixedSize ? `${item.w} × ${item.h}` : `${form.w} × ${form.h}`}
        </p>
        {item.fixedSize ? (
          <p className={HINT}>{copy.fixedFootprint}</p>
        ) : (
          <>
            <p className={HINT}>{copy.inUseHint}</p>
            {item.directional && <p className={HINT}>{copy.rotationHint}</p>}
            {fx.images + fx.sprites > 0 && (
              <div className="flex flex-col gap-2">
                <p role="note" className="text-label font-semibold text-danger">
                  {copy.resizeWarning(fx.images, fx.sprites)}
                </p>
                <label className="flex min-h-control cursor-pointer items-center gap-2 text-label text-text-primary">
                  <input
                    type="checkbox"
                    className="size-5 flex-none"
                    checked={form.confirmResize}
                    disabled={busy}
                    onChange={(e) => p.onChange({ confirmResize: e.target.checked })}
                  />
                  {copy.confirmResize}
                </label>
              </div>
            )}
          </>
        )}
      </fieldset>

      {item.kind === "chair" ? (
        <p className={HINT}>{copy.chairNote}</p>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="flex min-h-control cursor-pointer items-center gap-2 text-label text-text-primary">
            <input
              type="checkbox"
              className="size-5 flex-none"
              checked={form.shown}
              disabled={busy}
              onChange={(e) => p.onChange({ shown: e.target.checked })}
            />
            {copy.shown}
          </span>
          <span className={HINT}>{copy.hideHint}</span>
        </label>
      )}

      {p.confirmingReset ? (
        <div className="flex flex-col gap-3 rounded-xl border border-divider p-3">
          <ResetMapItemBody item={item} />
          {p.dirty && <p className="text-label font-semibold text-danger">{ed.reset.lost}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="pixel" size="sm" disabled={busy} onClick={p.onReset}>
              {resetCopy.confirm}
            </Button>
            <Button
              variant="tonal"
              size="sm"

              disabled={busy}
              onClick={p.onKeepEditing}
            >
              {ed.reset.keep}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            variant="outlined"
            size="sm"

            disabled={busy || isLibraryDefault(item)}
            onClick={p.onAskReset}
          >
            {ed.reset.button}
          </Button>
        </div>
      )}
    </div>
  );
}
