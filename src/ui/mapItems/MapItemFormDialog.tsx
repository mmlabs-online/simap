"use client";

import { useState } from "react";
import { MAP_ITEM_LIMITS, type MapItemDto } from "@/lib/map-items/types";
import { kitCopy } from "../copy/kit";
import { mapItemsCopy } from "../copy/mapItems";
import { Button } from "../Button";
import { DialogField, DialogSelect, EntityFormDialog } from "../EntityFormDialog";
import type { MapItemsApi } from "./map-items-api";
import { formFromItem, patchFrom, resizeEffects, type MapItemForm } from "./map-item-form";
import { isLibraryDefault, settleMapItem } from "./map-items-state";

const copy = mapItemsCopy.form;
const CAPTION =
  "text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant px-0.5";
const HINT = "text-xs font-medium text-on-surface-variant";
const SIZES = Array.from(
  { length: MAP_ITEM_LIMITS.sizeMax - MAP_ITEM_LIMITS.sizeMin + 1 },
  (_, i) => MAP_ITEM_LIMITS.sizeMin + i,
);

type Props = {
  item: MapItemDto;
  /** Existing group names, offered as suggestions. */
  groups: readonly string[];
  api: MapItemsApi;
  onClose: () => void;
  onDone: () => void;
  onReset: () => void;
};

/** Edit one map item's name, group, visibility and size. Closes itself through `onDone` after a saved change. */
export function MapItemFormDialog(props: Props) {
  return <MapItemFormInner key={props.item.builtinKey} {...props} />;
}

function MapItemFormInner({ item, groups, api, onClose, onDone, onReset }: Props) {
  const [form, setForm] = useState<MapItemForm>(formFromItem(item));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const patch = patchFrom(item, form);
    if (patch.kind === "unchanged") return onClose();
    if (patch.kind === "invalid") {
      return setError(mapItemsCopy.fieldErrors[patch.field] ?? mapItemsCopy.fieldErrors.body);
    }
    if (patch.kind === "needsConfirm") return setError(copy.confirmFirst);
    setSubmitting(true);
    const settled = settleMapItem(await api.patch(item.builtinKey, patch.value));
    setSubmitting(false);
    if (settled.kind === "done") return onDone();
    setError(settled.message);
  }

  return (
    <EntityFormDialog
      open
      title={copy.title}
      submitLabel={kitCopy.save}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <MapItemFormFields
        item={item}
        form={form}
        groups={groups}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onReset={onReset}
      />
    </EntityFormDialog>
  );
}

/** The form fields. Props only, so the markup can be tested without effects. */
export function MapItemFormFields({
  item,
  form,
  groups,
  onChange,
  onReset,
}: {
  item: MapItemDto;
  form: MapItemForm;
  groups: readonly string[];
  onChange: (patch: Partial<MapItemForm>) => void;
  onReset: () => void;
}) {
  const fx = resizeEffects(item, form.w, form.h);
  const listId = `map-item-groups-${item.builtinKey}`;
  return (
    <>
      <p className="text-sm text-on-surface">
        <span className={CAPTION}>{copy.key}</span>{" "}
        <span className="font-mono">{item.builtinKey}</span>
      </p>
      <DialogField
        label={copy.name}
        icon="edit"
        value={form.name}
        onChange={(e) => onChange({ name: e.target.value })}
        maxLength={MAP_ITEM_LIMITS.name}
        autoComplete="off"
        required
      />
      <DialogField
        label={copy.group}
        icon="category"
        value={form.group}
        onChange={(e) => onChange({ group: e.target.value })}
        maxLength={MAP_ITEM_LIMITS.group}
        list={listId}
        autoComplete="off"
        required
      />
      <datalist id={listId}>
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      {item.kind === "chair" ? (
        <p className={HINT}>{copy.chairNote}</p>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-sm font-medium text-on-surface">
            <input
              type="checkbox"
              checked={form.shown}
              onChange={(e) => onChange({ shown: e.target.checked })}
            />
            {copy.shown}
          </span>
          <span className={HINT}>{copy.hideHint}</span>
        </label>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className={CAPTION}>{copy.size}</legend>
        {item.fixedSize ? (
          <p className="text-sm font-medium text-on-surface">
            {`${item.w} × ${item.h}`}
            <span className={`${HINT} block`}>{copy.fixedReason[item.kind]}</span>
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <DialogSelect
                label={copy.width}
                icon="grid_view"
                value={form.w}
                onChange={(e) => onChange({ w: Number(e.target.value) })}
              >
                {SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </DialogSelect>
              <DialogSelect
                label={copy.height}
                icon="grid_view"
                value={form.h}
                onChange={(e) => onChange({ h: Number(e.target.value) })}
              >
                {SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </DialogSelect>
            </div>
            <p className="text-sm font-bold text-on-surface">{`${form.w} × ${form.h}`}</p>
            <p className={HINT}>{copy.inUseHint}</p>
            {item.directional && <p className={HINT}>{copy.rotationHint}</p>}
            {fx.images + fx.sprites > 0 && (
              <div className="flex flex-col gap-2">
                <p role="note" className="text-[13px] font-semibold text-error">
                  {copy.resizeWarning(fx.images, fx.sprites)}
                </p>
                <label className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <input
                    type="checkbox"
                    checked={form.confirmResize}
                    onChange={(e) => onChange({ confirmResize: e.target.checked })}
                  />
                  {copy.confirmResize}
                </label>
              </div>
            )}
          </>
        )}
      </fieldset>

      <div>
        <Button variant="outlined" size="sm" disabled={isLibraryDefault(item)} onClick={onReset}>
          {copy.reset}
        </Button>
      </div>
    </>
  );
}
