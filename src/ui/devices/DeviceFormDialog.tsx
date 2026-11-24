"use client";

import { useId, useState } from "react";
import { DEVICE_LIMITS, type DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { kitCopy } from "../copy/kit";
import { DialogField, EntityFormDialog } from "../EntityFormDialog";
import { canLoadMore, type LoadPage, type PickerMember } from "../seats/member-picker";
import { MemberPickerFields } from "../seats/MemberPickerDialog";
import { useMemberPicker } from "../seats/useMemberPicker";
import {
  deviceErrorMessage,
  emptyForm,
  formFromDevice,
  toCreateBody,
  toPatchBody,
  type DeviceForm,
  type DeviceOwner,
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
  isAdmin: boolean;
  api: DevicesApi;
  loadPage: LoadPage;
  onClose: () => void;
  onDone: () => void;
}) {
  if (!open) return null;
  return <DeviceFormInner key={device?.id ?? "new"} device={device} {...rest} />;
}

function DeviceFormInner({
  device,
  isAdmin,
  api,
  loadPage,
  onClose,
  onDone,
}: {
  device: DeviceDto | null;
  isAdmin: boolean;
  api: DevicesApi;
  loadPage: LoadPage;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<DeviceForm>(device ? formFromDevice(device) : emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const create = toCreateBody(form, { isAdmin });
      if (create.kind === "invalid") return setError(create.message);
      setSubmitting(true);
      result = await api.create(create.body);
    }
    setSubmitting(false);
    if (result.ok) return onDone();
    // On edit the device is gone; on create the chosen owner is gone, so the dialog stays open.
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
        isAdmin={isAdmin}
        form={form}
        ownerName={device?.owner.displayName ?? null}
        loadPage={loadPage}
        onField={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
        onOwner={(owner) => setForm((f) => ({ ...f, owner }))}
      />
    </EntityFormDialog>
  );
}

/** The form fields. Props only, so the markup can be tested without effects. */
export function DeviceFormFields({
  mode,
  isAdmin,
  form,
  ownerName,
  loadPage,
  onField,
  onOwner,
}: {
  mode: "create" | "edit";
  isAdmin: boolean;
  form: DeviceForm;
  ownerName: string | null;
  loadPage: LoadPage;
  onField: (key: "name" | "type" | "inventoryNumber" | "mac", value: string) => void;
  onOwner: (owner: DeviceOwner) => void;
}) {
  const listId = useId();
  const picked = form.owner.kind === "member" ? form.owner.member : null;
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
        {devicesCopy.typeSuggestions.map((t) => (
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
      {mode === "create" && isAdmin && (
        <fieldset className="flex flex-col gap-2">
          <legend className={CAPTION}>{copy.fields.owner}</legend>
          <label className="flex items-center gap-2 text-sm font-medium text-on-surface">
            <input
              type="radio"
              name="owner-kind"
              checked={form.owner.kind === "me"}
              onChange={() => onOwner({ kind: "me" })}
            />
            {copy.ownerMe}
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-on-surface">
            <input
              type="radio"
              name="owner-kind"
              checked={form.owner.kind === "member"}
              onChange={() => onOwner({ kind: "member", member: null })}
            />
            {copy.ownerOther}
          </label>
          {form.owner.kind === "member" && (
            <>
              {picked && (
                <p className="text-sm font-semibold text-on-surface">
                  {copy.ownerSelected(picked.displayName)}
                </p>
              )}
              <OwnerPicker
                loadPage={loadPage}
                onPick={(member) => onOwner({ kind: "member", member })}
              />
            </>
          )}
        </fieldset>
      )}
    </>
  );
}

/** Mounted only for "Another member", so the member list loads lazily. */
function OwnerPicker({
  loadPage,
  onPick,
}: {
  loadPage: LoadPage;
  onPick: (member: PickerMember) => void;
}) {
  const picker = useMemberPicker(loadPage, 0);
  const { state } = picker;
  return (
    <MemberPickerFields
      state={state}
      query={picker.query}
      occupantId={null}
      canMore={canLoadMore(state)}
      onQuery={picker.setQuery}
      onSelect={(id) => {
        picker.select(id);
        const member = state.items.find((m) => m.id === id);
        if (member) onPick(member);
      }}
      onMore={() => void picker.loadMore()}
      onRetry={picker.retry}
    />
  );
}
