"use client";

import { useState } from "react";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { EntityFormDialog } from "../EntityFormDialog";
import type { DevicesApi } from "./devices-api";
import { NoteField } from "./NoteField";
import { emptyReturnForm, settleReturn, toReturnBody, type ReturnForm } from "./return-device";

const copy = devicesCopy.giveBack;
const CAPTION =
  "text-[11px] font-extrabold tracking-[0.05em] uppercase text-on-surface-variant px-0.5";
const HINT = "text-xs text-on-surface-variant px-0.5";

/** Props only: current owner, note and what happens next. */
export function ReturnDeviceFields({
  device,
  form,
  onNote,
}: {
  device: DeviceDto;
  form: ReturnForm;
  onNote: (v: string) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className={CAPTION}>{copy.currentOwner}</span>
        <span className="text-sm font-medium text-on-surface">{device.owner?.displayName}</span>
      </div>
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

/** Start a return of an owned device to the org inventory. Mounted only while open, keyed by device. */
export function ReturnDeviceDialog({
  device,
  ...rest
}: DialogProps & { device: DeviceDto | null }) {
  if (!device) return null;
  return <ReturnInner key={device.id} device={device} {...rest} />;
}

function ReturnInner({
  device,
  devicesApi,
  onClose,
  onStale,
  onDone,
}: DialogProps & { device: DeviceDto }) {
  const [form, setForm] = useState<ReturnForm>(emptyReturnForm());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const plan = toReturnBody(form);
    if (plan.kind === "invalid") return setError(plan.message);
    setSubmitting(true);
    const result = await devicesApi.startReturn(device.id, plan.body.note);
    setSubmitting(false);
    const outcome = settleReturn(result);
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
      <ReturnDeviceFields
        device={device}
        form={form}
        onNote={(note) => setForm((f) => ({ ...f, note }))}
      />
    </EntityFormDialog>
  );
}
