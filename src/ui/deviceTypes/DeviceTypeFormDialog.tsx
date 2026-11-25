"use client";

import { useState } from "react";
import {
  DEVICE_KINDS,
  DEVICE_TYPE_LIMITS,
  type DeviceKind,
  type DeviceTypeDto,
} from "@/lib/device-types/types";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { kitCopy } from "../copy/kit";
import { DialogField, EntityFormDialog } from "../EntityFormDialog";
import { DeskSlotDiagram } from "./DeskSlotDiagram";
import {
  emptyForm,
  formFromType,
  toCreateBody,
  toPatchBody,
  type DeviceTypeForm,
} from "./device-type-form";
import type { DeviceTypesApi } from "./device-types-api";
import { settleSave } from "./device-types-state";

const copy = deviceTypesCopy.form;
const CAPTION =
  "text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant px-0.5";

type Props = {
  /** `null` creates a type. */
  item: DeviceTypeDto | null;
  api: DeviceTypesApi;
  onClose: () => void;
  onDone: () => void;
};

/** Create (`item` null) or edit one device type. Closes itself through `onDone` after a saved change. */
export function DeviceTypeFormDialog(props: Props) {
  return <DeviceTypeFormInner key={props.item?.id ?? "new"} {...props} />;
}

function DeviceTypeFormInner({ item, api, onClose, onDone }: Props) {
  const [form, setForm] = useState<DeviceTypeForm>(item ? formFromType(item) : emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let result;
    if (item) {
      const patch = toPatchBody(form, item);
      if (patch.kind === "unchanged") return onClose();
      if (patch.kind === "invalid") return setError(patch.message);
      setSubmitting(true);
      result = await api.update(item.id, patch.body);
    } else {
      const create = toCreateBody(form);
      if (create.kind === "invalid") return setError(create.message);
      setSubmitting(true);
      result = await api.create(create.body);
    }
    setSubmitting(false);
    const settled = settleSave(result);
    if (settled.kind === "done") return onDone();
    setError(settled.message);
  }

  return (
    <EntityFormDialog
      open
      title={item ? copy.editTitle : copy.createTitle}
      submitLabel={item ? kitCopy.save : copy.create}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <DeviceTypeFormFields
        form={form}
        onName={(name) => setForm((f) => ({ ...f, name }))}
        onSlot={(slot) => setForm((f) => ({ ...f, slot }))}
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
      <fieldset className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <legend className={CAPTION}>{copy.slot}</legend>
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
                <span className="text-on-surface-variant">{deviceTypesCopy.slots[kind].hint}</span>
              </span>
            </label>
          ))}
        </div>
        <DeskSlotDiagram kind={form.slot} />
      </fieldset>
    </>
  );
}
