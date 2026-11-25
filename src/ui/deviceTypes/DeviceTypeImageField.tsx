"use client";

import { useId } from "react";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { DeviceTypeThumb } from "./DeviceTypeThumb";
import type { ImageFieldView } from "./device-type-image";

const copy = deviceTypesCopy.form;
const CAPTION =
  "text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant px-0.5";
const BTN =
  "inline-flex items-center rounded-full bg-secondary-container text-on-secondary-container px-3 py-1.5 text-sm font-bold cursor-pointer focus-within:ring-2 focus-within:ring-primary";

/** The image section of the form. Props only, so the markup can be tested without effects. */
export function DeviceTypeImageField({
  view,
  error,
  disabled,
  onPick,
  onRemove,
  onUndo,
}: {
  view: ImageFieldView;
  error: string | null;
  disabled: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
  onUndo: () => void;
}) {
  const errId = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={CAPTION}>{copy.image}</legend>
      <div className="flex items-center gap-3">
        <DeviceTypeThumb
          url={view.previewUrl}
          alt={copy.alt[view.state === "remove" ? "none" : view.state]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className={BTN}>
            {view.state === "none" || view.state === "remove" ? copy.choose : copy.replace}
            <input
              type="file"
              accept="image/png"
              className="sr-only"
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errId : undefined}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (file) onPick(file);
              }}
            />
          </label>
          {view.showRemove && (
            <button
              type="button"
              disabled={disabled}
              onClick={onRemove}
              className="text-sm font-bold text-error px-2 py-1.5"
            >
              {copy.remove}
            </button>
          )}
          {view.showUndo && (
            <button
              type="button"
              disabled={disabled}
              onClick={onUndo}
              className="text-sm font-bold text-primary px-2 py-1.5"
            >
              {copy.keepCurrent}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-on-surface-variant">{copy.hint}</p>
      {view.state === "remove" && (
        <p className="text-xs text-on-surface-variant">{copy.pendingRemove}</p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
