"use client";

import { useEffect, useState } from "react";
import {
  DEVICE_KINDS,
  DEVICE_TYPE_LIMITS,
  type DeviceKind,
  type DeviceTypeDto,
} from "@/lib/device-types/types";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { kitCopy } from "../copy/kit";
import { DialogField, EntityFormDialog } from "../EntityFormDialog";
import type { Atlas } from "../roomlayout/loadAtlas";
import { DeskSlotDiagram } from "./DeskSlotDiagram";
import { emptyForm, formFromType, type DeviceTypeForm } from "./device-type-form";
import {
  checkImageFile,
  imageCheckMessage,
  imageFieldView,
  type ImageDraft,
} from "./device-type-image";
import { saveDeviceType } from "./device-type-save";
import { DeviceTypeImageField } from "./DeviceTypeImageField";
import { DeviceTypeSpriteField } from "./DeviceTypeSpriteField";
import type { DeviceTypesApi } from "./device-types-api";

const copy = deviceTypesCopy.form;
const CAPTION =
  "text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant px-0.5";

type Props = {
  /** `null` creates a type. */
  item: DeviceTypeDto | null;
  api: DeviceTypesApi;
  imageUrl: (t: DeviceTypeDto) => string | null;
  /** Package atlas for the sprite thumbnails; null while loading or failed. */
  atlas: Atlas | null;
  onClose: () => void;
  onDone: () => void;
};

/** Create (`item` null) or edit one device type. Closes itself through `onDone` after a saved change. */
export function DeviceTypeFormDialog(props: Props) {
  return <DeviceTypeFormInner key={props.item?.id ?? "new"} {...props} />;
}

function DeviceTypeFormInner({ item, api, imageUrl, atlas, onClose, onDone }: Props) {
  const [current, setCurrent] = useState<DeviceTypeDto | null>(item);
  const [form, setForm] = useState<DeviceTypeForm>(item ? formFromType(item) : emptyForm());
  const [draft, setDraft] = useState<ImageDraft>({ kind: "keep" });
  const [pickError, setPickError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stagedUrl = draft.kind === "replace" ? draft.url : null;
  useEffect(() => {
    if (!stagedUrl) return;
    return () => URL.revokeObjectURL(stagedUrl);
  }, [stagedUrl]);

  /** A type saved during this dialog's life means the list must reload. */
  const close = () => (current !== item ? onDone() : onClose());

  async function pick(file: File) {
    const checked = await checkImageFile(file);
    if (!checked.ok) return setPickError(imageCheckMessage(checked.code));
    setPickError(null);
    const url = URL.createObjectURL(new Blob([checked.bytes], { type: "image/png" }));
    setDraft({ kind: "replace", bytes: checked.bytes, url });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPickError(null);
    setSubmitting(true);
    const result = await saveDeviceType({ api, current, form, draft });
    setSubmitting(false);
    switch (result.kind) {
      case "invalid":
      case "failed":
        return setError(result.message);
      case "closed":
        return close();
      case "done":
        return onDone();
      case "imageFailed":
        setCurrent(result.saved);
        return setError(result.message);
    }
  }

  return (
    <EntityFormDialog
      open
      title={current ? copy.editTitle : copy.createTitle}
      submitLabel={current ? kitCopy.save : copy.create}
      submitting={submitting}
      error={error}
      onClose={close}
      onSubmit={submit}
    >
      <DeviceTypeFormFields
        form={form}
        onName={(name) => setForm((f) => ({ ...f, name }))}
        onSlot={(slot) => setForm((f) => ({ ...f, slot }))}
      />
      <DeviceTypeSpriteField
        value={form.sprite}
        slot={form.slot}
        imageShown={draft.kind === "replace" || (draft.kind === "keep" && !!current?.hasImage)}
        atlas={atlas}
        disabled={submitting}
        onChange={(sprite) => setForm((f) => ({ ...f, sprite }))}
      />
      <DeviceTypeImageField
        view={imageFieldView(draft, current?.hasImage ?? false, current ? imageUrl(current) : null)}
        error={pickError}
        disabled={submitting}
        onPick={(file) => void pick(file)}
        onRemove={() => setDraft(draft.kind === "replace" ? { kind: "keep" } : { kind: "remove" })}
        onUndo={() => setDraft({ kind: "keep" })}
      />
    </EntityFormDialog>
  );
}

/** The form fields. Props only, so the markup can be tested without effects. */
export function DeviceTypeFormFields({
  form,
  onName,
  onSlot,
}: {
  form: DeviceTypeForm;
  onName: (name: string) => void;
  onSlot: (slot: DeviceKind) => void;
}) {
  return (
    <>
      <DialogField
        label={copy.name}
        icon="category"
        value={form.name}
        onChange={(e) => onName(e.target.value)}
        maxLength={DEVICE_TYPE_LIMITS.name}
        autoComplete="off"
        required
      />
      <fieldset className="flex flex-col gap-2">
        <legend className={CAPTION}>{copy.slot}</legend>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            {DEVICE_KINDS.map((kind) => (
              <label key={kind} className="flex items-start gap-2 text-sm text-on-surface">
                <input
                  type="radio"
                  name="device-type-slot"
                  className="mt-1"
                  checked={form.slot === kind}
                  onChange={() => onSlot(kind)}
                />
                <span className="flex flex-col">
                  <span className="font-medium">{deviceTypesCopy.slots[kind].label}</span>
                  <span className="text-on-surface-variant">
                    {deviceTypesCopy.slots[kind].hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <DeskSlotDiagram kind={form.slot} />
        </div>
      </fieldset>
    </>
  );
}
