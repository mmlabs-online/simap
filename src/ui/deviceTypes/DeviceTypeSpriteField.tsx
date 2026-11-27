import type { DeviceKind } from "@/lib/device-types/types";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { FramePreview } from "../mapItems/FramePreview";
import type { Atlas } from "../roomlayout/loadAtlas";
import { spriteFieldView } from "./device-type-sprite";

const copy = deviceTypesCopy.form.sprite;
const CAPTION = "text-label text-text-primary";

/** Picker of the bundled package sprite for a device type. Props only; thumbnails need an atlas. */
export function DeviceTypeSpriteField({
  value,
  slot,
  imageShown,
  atlas,
  disabled,
  onChange,
}: {
  value: string | null;
  slot: DeviceKind;
  imageShown: boolean;
  atlas: Atlas | null;
  disabled?: boolean;
  onChange: (sprite: string | null) => void;
}) {
  const view = spriteFieldView({ value, slot, imageShown });
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={CAPTION}>{copy.legend}</legend>
      <p className="text-caption text-text-secondary">{copy.hint}</p>
      {view.hiddenByImage && (
        <p role="status" className="text-caption font-medium text-text-secondary">
          {copy.hiddenByImage}
        </p>
      )}
      {view.unavailable !== null && (
        <p role="status" className="text-caption font-medium text-danger">
          {copy.unavailable(view.unavailable)}
        </p>
      )}
      <div role="radiogroup" aria-label={copy.legend} className="flex flex-col gap-2">
        {view.options.map((o) => (
          <label
            key={o.value ?? "built-in"}
            className="flex min-h-control cursor-pointer items-center gap-2 text-label font-normal text-text-primary"
          >
            <input
              type="radio"
              className="size-5 flex-none"
              name="device-type-sprite"
              checked={o.checked}
              disabled={disabled}
              onChange={() => onChange(o.value)}
            />
            {atlas && (
              <FramePreview
                atlas={atlas}
                frameKey={o.preview}
                box={32}
                label={copy.frameAlt(o.preview)}
              />
            )}
            {o.value === null ? (
              <span>{copy.builtIn(deviceTypesCopy.slots[slot].label)}</span>
            ) : (
              <span className="font-mono text-caption">{o.value}</span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
