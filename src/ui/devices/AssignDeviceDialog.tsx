"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { DialogField, EntityFormDialog } from "../EntityFormDialog";
import { canLoadMore, selectedMember, type LoadPage } from "../seats/member-picker";
import { MemberPickerFields } from "../seats/MemberPickerDialog";
import type { SeatsApi } from "../seats/seats-api";
import { useMemberPicker } from "../seats/useMemberPicker";
import {
  emptyAssignForm,
  expiryMin,
  holdingForm,
  settleAssign,
  todayNow,
  toAssignBody,
  toHoldingBody,
  type AssignForm,
  type AssignMode,
} from "./assign-device";
import type { DevicesApi } from "./devices-api";
import { NoteField } from "./NoteField";

const copy = devicesCopy.assign;
const CAPTION =
  "text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant px-0.5";
const DATE_INPUT = "input[type=date]";
const HINT = "text-xs text-on-surface-variant px-0.5";
/** Props only: picker (assign mode) or holder line (edit mode), note, and the expiry fieldset. */
export function AssignDeviceFields({
  mode,
  device,
  picker,
  form,
  min,
  fieldsetRef,
  onNote,
  onNoExpiry,
  onDate,
}: {
  mode: AssignMode;
  device: DeviceDto;
  picker: ReactNode;
  form: AssignForm;
  min: string;
  fieldsetRef?: RefObject<HTMLFieldSetElement | null>;
  onNote: (v: string) => void;
  onNoExpiry: (v: boolean) => void;
  onDate: (v: string) => void;
}) {
  return (
    <>
      {mode === "assign" ? (
        picker
      ) : (
        <div className="flex flex-col gap-1">
          <span className={CAPTION}>{copy.holder}</span>
          <span className="text-sm font-medium text-on-surface">{device.owner?.displayName}</span>
        </div>
      )}
      <NoteField value={form.note} onChange={onNote} label={copy.note} hint={copy.noteHint} />
      <fieldset ref={fieldsetRef} className="flex flex-col gap-2 border-0 p-0 m-0 min-w-0">
        <legend className={CAPTION}>{copy.expiry}</legend>
        <label className="flex items-center gap-2 text-sm font-medium text-on-surface">
          <input
            type="checkbox"
            checked={form.noExpiry}
            onChange={(e) => onNoExpiry(e.target.checked)}
          />
          {copy.noExpiry}
        </label>
        <DialogField
          label={copy.expiryDate}
          icon="event"
          type="date"
          value={form.expiresOn}
          min={min}
          disabled={form.noExpiry}
          onChange={(e) => onDate(e.target.value)}
        />
        <span className={HINT}>{copy.tzHint}</span>
      </fieldset>
    </>
  );
}

type DialogProps = {
  mode: AssignMode;
  devicesApi: DevicesApi;
  seatsApi: SeatsApi;
  onClose: () => void;
  onStale: () => void;
  onDone: (mode: AssignMode) => void;
};

/** Assign an org-inventory device to a member, or edit the current holding. Keyed by device and mode. */
export function AssignDeviceDialog({
  open,
  device,
  ...rest
}: DialogProps & { open: boolean; device: DeviceDto | null }) {
  if (!open || !device) return null;
  return <AssignInner key={`${device.id}:${rest.mode}`} device={device} {...rest} />;
}

/** Edit mode has no member list: the picker hook still runs, but loads nothing. */
const idlePage: LoadPage = async () => ({ ok: true, value: { items: [], nextCursor: null } });

function AssignInner({
  device,
  mode,
  devicesApi,
  seatsApi,
  onClose,
  onStale,
  onDone,
}: DialogProps & { device: DeviceDto }) {
  const [today] = useState(todayNow);
  const [form, setForm] = useState<AssignForm>(
    mode === "edit" ? holdingForm(device) : emptyAssignForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const picker = useMemberPicker(
    mode === "assign" ? seatsApi.activeMembers : idlePage,
    reloadToken,
  );

  function focusDate() {
    const el = fieldsetRef.current?.querySelector(DATE_INPUT);
    if (el instanceof HTMLElement) el.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let result;
    if (mode === "assign") {
      const member = selectedMember(picker.state, null);
      const plan = toAssignBody(form, member?.id ?? null, today);
      if (plan.kind === "invalid") return setError(plan.message);
      setSubmitting(true);
      result = await devicesApi.assign(device.id, plan.body);
    } else {
      const plan = toHoldingBody(form, device, today);
      if (plan.kind === "unchanged") return onClose();
      if (plan.kind === "invalid") return setError(plan.message);
      setSubmitting(true);
      result = await devicesApi.updateHolding(device.id, plan.body);
    }
    setSubmitting(false);
    const outcome = settleAssign(result);
    if (outcome.kind === "done") return onDone(mode);
    setError(outcome.message);
    if (outcome.stale) onStale();
    if (outcome.reloadMembers) setReloadToken((t) => t + 1);
  }

  return (
    <EntityFormDialog
      open
      title={copy.titles[mode]}
      subtitle={devicesCopy.typeLine(device.name, device.inventoryNumber)}
      submitLabel={copy.submit[mode]}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <AssignDeviceFields
        mode={mode}
        device={device}
        picker={
          <MemberPickerFields
            state={picker.state}
            query={picker.query}
            occupantId={null}
            canMore={canLoadMore(picker.state)}
            onQuery={picker.setQuery}
            onSelect={picker.select}
            onMore={() => void picker.loadMore()}
            onRetry={picker.retry}
          />
        }
        form={form}
        min={expiryMin(mode, device.holding, today)}
        fieldsetRef={fieldsetRef}
        onNote={(note) => setForm((f) => ({ ...f, note }))}
        onNoExpiry={(noExpiry) => {
          setForm((f) => ({ ...f, noExpiry, expiresOn: noExpiry ? "" : f.expiresOn }));
          if (!noExpiry) setTimeout(focusDate, 0);
        }}
        onDate={(expiresOn) => setForm((f) => ({ ...f, expiresOn }))}
      />
    </EntityFormDialog>
  );
}
