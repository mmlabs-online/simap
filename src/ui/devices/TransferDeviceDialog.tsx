"use client";

import { useId, useState, type ComponentProps } from "react";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { EntityFormDialog } from "../EntityFormDialog";
import { canLoadMore, selectedMember } from "../seats/member-picker";
import { MemberPickerFields } from "../seats/MemberPickerDialog";
import type { SeatsApi } from "../seats/seats-api";
import { useMemberPicker } from "../seats/useMemberPicker";
import type { DevicesApi } from "./devices-api";
import { NoteField } from "./NoteField";
import {
  emptyTransferForm,
  settleTransfer,
  toTransferBody,
  type TransferForm,
} from "./transfer-device";

const copy = devicesCopy.transfer;
const CAPTION = "text-label text-text-primary";
const HINT = "text-caption text-text-secondary";

type PickerProps = Omit<
  ComponentProps<typeof MemberPickerFields>,
  "occupantId" | "occupantLabel" | "listLabel"
>;

/** Props only: current owner, recipient picker, note, expiry hint and what happens next. */
export function TransferDeviceFields({
  device,
  picker,
  form,
  recipientName,
  onNote,
}: {
  device: DeviceDto;
  picker: PickerProps;
  form: TransferForm;
  /** Display name of the selected recipient, or null before a selection. */
  recipientName: string | null;
  onNote: (v: string) => void;
}) {
  const nextId = useId();
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className={CAPTION}>{copy.currentOwner}</span>
        <span className="text-label font-normal text-text-primary">
          {device.owner?.displayName}
        </span>
      </div>
      <div aria-describedby={nextId} className="flex flex-col gap-3">
        <MemberPickerFields
          {...picker}
          occupantId={device.owner?.id ?? null}
          occupantLabel={copy.ownerSuffix}
          listLabel={copy.recipients}
        />
      </div>
      <NoteField value={form.note} onChange={onNote} label={copy.note} hint={copy.noteHint} />
      <p className={HINT}>{copy.expiryHint}</p>
      <p id={nextId} className={HINT}>
        {recipientName === null ? copy.nextBefore : copy.nextAfter(recipientName)}
      </p>
    </>
  );
}

type DialogProps = {
  devicesApi: DevicesApi;
  seatsApi: SeatsApi;
  onClose: () => void;
  onStale: () => void;
  onDone: (device: DeviceDto) => void;
};

/** Start a transfer of an owned device. Mounted only while open, keyed by device. */
export function TransferDeviceDialog({
  device,
  ...rest
}: DialogProps & { device: DeviceDto | null }) {
  if (!device) return null;
  return <TransferInner key={device.id} device={device} {...rest} />;
}

function TransferInner({
  device,
  devicesApi,
  seatsApi,
  onClose,
  onStale,
  onDone,
}: DialogProps & { device: DeviceDto }) {
  const [form, setForm] = useState<TransferForm>(emptyTransferForm());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const picker = useMemberPicker(seatsApi.activeMembers, reloadToken);
  const ownerId = device.owner?.id ?? null;
  const member = selectedMember(picker.state, ownerId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const plan = toTransferBody(form, member?.id ?? null);
    if (plan.kind === "invalid") return setError(plan.message);
    setSubmitting(true);
    const result = await devicesApi.startTransfer(device.id, plan.body);
    setSubmitting(false);
    const outcome = settleTransfer(result);
    if (outcome.kind === "done") return onDone(device);
    setError(outcome.message);
    if (outcome.stale) onStale();
    if (outcome.reloadMembers) setReloadToken((t) => t + 1);
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
      <TransferDeviceFields
        device={device}
        picker={{
          state: picker.state,
          query: picker.query,
          canMore: canLoadMore(picker.state),
          onQuery: picker.setQuery,
          onSelect: picker.select,
          onMore: () => void picker.loadMore(),
          onRetry: picker.retry,
        }}
        form={form}
        recipientName={member?.displayName ?? null}
        onNote={(note) => setForm((f) => ({ ...f, note }))}
      />
    </EntityFormDialog>
  );
}
