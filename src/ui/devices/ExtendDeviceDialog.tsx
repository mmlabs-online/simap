"use client";

import { useState } from "react";
import type { DeviceDto } from "@/lib/devices/types";
import { todayUtc7 } from "@/lib/devices/holding";
import { devicesCopy } from "../copy/devices";
import { DialogField, EntityFormDialog } from "../EntityFormDialog";
import type { DevicesApi } from "./devices-api";
import {
  emptyExtendForm,
  nextDay,
  settleExtend,
  toExtendBody,
  type ExtendForm,
} from "./extend-device";
import { NoteField } from "./NoteField";

const copy = devicesCopy.extend;
const CAPTION =
  "text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant px-0.5";
const HINT = "text-xs text-on-surface-variant px-0.5";

/** Props only: current expiry, the new date, the note and what happens next. */
export function ExtendDeviceFields({
  device,
  form,
  min,
  onDate,
  onNote,
}: {
  device: DeviceDto;
  form: ExtendForm;
  min: string;
  onDate: (v: string) => void;
  onNote: (v: string) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className={CAPTION}>{copy.currentExpiry}</span>
        <span className="text-sm font-medium text-on-surface">{device.holding?.expiresOn}</span>
      </div>
      <DialogField
        label={copy.newDate}
        icon="event"
        type="date"
        required
        value={form.newExpiresOn}
        min={min}
        onChange={(e) => onDate(e.target.value)}
      />
      <span className={HINT}>{copy.newDateHint}</span>
      <NoteField value={form.note} onChange={onNote} label={copy.note} hint={copy.noteHint} />
      <p className={HINT}>{copy.next}</p>
    </>
  );
}

type DialogProps = {
  devicesApi: DevicesApi;
  onClose: () => void;
  onStale: () => void;
  onDone: (device: DeviceDto) => void;
};

/** Request an extension of an overdue device. Mounted only while open, keyed by device. */
export function ExtendDeviceDialog({
  device,
  ...rest
}: DialogProps & { device: DeviceDto | null }) {
  if (!device) return null;
  return <ExtendInner key={device.id} device={device} {...rest} />;
}

function ExtendInner({
  device,
  devicesApi,
  onClose,
  onStale,
  onDone,
}: DialogProps & { device: DeviceDto }) {
  const [today] = useState(() => todayUtc7(new Date()));
  const [form, setForm] = useState<ExtendForm>(emptyExtendForm());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const plan = toExtendBody(form, today);
    if (plan.kind === "invalid") return setError(plan.message);
    setSubmitting(true);
    const result = await devicesApi.startExtension(
      device.id,
      plan.body.newExpiresOn,
      plan.body.note,
    );
    setSubmitting(false);
    const outcome = settleExtend(result);
    if (outcome.kind === "done") return onDone(device);
    setError(outcome.message);
    if (outcome.stale) onStale();
  }

  return (
    <EntityFormDialog
      open
      title={copy.title}
      subtitle={devicesCopy.typeLine(device.name, device.inventoryNumber)}
      submitLabel={copy.submit}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <ExtendDeviceFields
        device={device}
        form={form}
        min={nextDay(today)}
        onDate={(newExpiresOn) => setForm((f) => ({ ...f, newExpiresOn }))}
        onNote={(note) => setForm((f) => ({ ...f, note }))}
      />
    </EntityFormDialog>
  );
}
