"use client";

import { useId, useState } from "react";
import { DEVICE_LIMITS, type DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { kitCopy } from "../copy/kit";
import { useTypeSuggestions } from "../deviceTypes/useTypeSuggestions";
import { DialogField, EntityFormDialog } from "../EntityFormDialog";
import {
  deviceErrorMessage,
  emptyForm,
  formFromDevice,
  toCreateBody,
  toPatchBody,
  type DeviceForm,
} from "./device-form";
import type { DevicesApi } from "./devices-api";

const copy = devicesCopy.form;
const CAPTION =
  "text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant px-0.5";

/** Create (`device` null) or edit one device. Closes itself through `onDone` after a saved change. */
export function DeviceFormDialog({
  open,
  device,
  ...rest
}: {
  open: boolean;
  device: DeviceDto | null;
  api: DevicesApi;
  onClose: () => void;
  onDone: () => void;
}) {
  if (!open) return null;
  return <DeviceFormInner key={device?.id ?? "new"} device={device} {...rest} />;
}

function DeviceFormInner({
  device,
  api,
  onClose,
  onDone,
}: {
  device: DeviceDto | null;
  api: DevicesApi;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<DeviceForm>(device ? formFromDevice(device) : emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const suggestions = useTypeSuggestions();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let result;
    if (device) {
      const patch = toPatchBody(form, device);
      if (patch.kind === "unchanged") return onClose();
      if (patch.kind === "invalid") return setError(patch.message);
      setSubmitting(true);
      result = await api.update(device.id, patch.body);
    } else {
      const create = toCreateBody(form);
      if (create.kind === "invalid") return setError(create.message);
      setSubmitting(true);
      result = await api.create(create.body);
    }
    setSubmitting(false);
    if (result.ok) return onDone();
    // On edit the device is gone.
    if (device && result.code === "not_found") return onDone();
    setError(deviceErrorMessage(result.code));
  }

  return (
    <EntityFormDialog
      open
      title={device ? copy.editTitle : copy.createTitle}
      subtitle={device?.inventoryNumber}
      submitLabel={device ? kitCopy.save : copy.create}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <DeviceFormFields
        mode={device ? "edit" : "create"}
        form={form}
        ownerName={device ? (device.owner?.displayName ?? devicesCopy.orgInventory) : null}
        suggestions={suggestions}
        onField={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
      />
    </EntityFormDialog>
  );
}

/** The form fields. Props only, so the markup can be tested without effects. */
export function DeviceFormFields({
  mode,
  form,
  ownerName,
  suggestions,
  onField,
}: {
  mode: "create" | "edit";
  form: DeviceForm;
  ownerName: string | null;
  suggestions: readonly string[];
  onField: (key: "name" | "type" | "inventoryNumber" | "mac", value: string) => void;
}) {
  const listId = useId();
  return (
    <>
      <DialogField
        label={copy.fields.name}
        icon="edit_square"
        value={form.name}
        onChange={(e) => onField("name", e.target.value)}
        maxLength={DEVICE_LIMITS.name}
        autoComplete="off"
        required
      />
      <DialogField
        label={copy.fields.type}
        icon="grid_view"
        value={form.type}
        onChange={(e) => onField("type", e.target.value)}
        list={listId}
        maxLength={DEVICE_LIMITS.type}
        autoComplete="off"
        required
      />
      <datalist id={listId}>
        {suggestions.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <DialogField
        label={copy.fields.inventoryNumber}
        icon="fact_check"
        value={form.inventoryNumber}
        onChange={(e) => onField("inventoryNumber", e.target.value)}
        maxLength={DEVICE_LIMITS.inventoryNumber}
        spellCheck={false}
        autoComplete="off"
        required
      />
      <DialogField
        label={copy.fields.mac}
        icon="lan"
        value={form.mac}
        onChange={(e) => onField("mac", e.target.value)}
        placeholder={copy.macPlaceholder}
        spellCheck={false}
        autoComplete="off"
      />
      {mode === "edit" && (
        <div className="flex flex-col gap-1">
          <span className={CAPTION}>{copy.fields.owner}</span>
          <span className="text-sm font-medium text-on-surface">{ownerName}</span>
          <span className="text-sm text-on-surface-variant">{copy.ownerReadOnly}</span>
        </div>
      )}
    </>
  );
}
