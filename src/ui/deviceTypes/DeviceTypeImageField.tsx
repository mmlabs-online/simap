"use client";

import { useId } from "react";
import { Button } from "../Button";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { DeviceTypeThumb } from "./DeviceTypeThumb";
import type { ImageFieldView } from "./device-type-image";

const copy = deviceTypesCopy.form;
const CAPTION = "text-label text-text-primary";
const BTN =
  "field-box inline-flex min-h-control cursor-pointer items-center rounded-lg border border-border bg-surface px-4 text-label text-text-primary transition-[color,background-color,border-color,box-shadow,transform] duration-(--duration-ui) ease-out";

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
            <Button variant="danger" size="sm" disabled={disabled} onClick={onRemove}>
              {copy.remove}
            </Button>
          )}
          {view.showUndo && (
            <Button variant="outlined" size="sm" disabled={disabled} onClick={onUndo}>
              {copy.keepCurrent}
            </Button>
          )}
        </div>
      </div>
      <p className="text-caption text-text-secondary">{copy.hint}</p>
      {view.state === "remove" && (
        <p className="text-caption text-text-secondary">{copy.pendingRemove}</p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-caption font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
