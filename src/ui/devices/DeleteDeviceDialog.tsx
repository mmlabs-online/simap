"use client";

import { useState } from "react";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { EntityFormDialog } from "../EntityFormDialog";
import { settleDelete } from "./delete-device-flow";
import type { DevicesApi } from "./devices-api";

const copy = devicesCopy.delete;

/** Props only: the delete confirmation. */
export function DeleteDeviceBody({ device }: { device: DeviceDto }) {
  return (
    <div className="flex flex-col gap-1 text-label text-text-primary">
      <p>{copy.confirmBody(device.name, device.inventoryNumber)}</p>
    </div>
  );
}

type DialogProps = {
  api: DevicesApi;
  onClose: () => void;
  onStale: () => void;
  onDone: () => void;
};

/** Delete one org-inventory device. Mounted only while a device is set. */
export function DeleteDeviceDialog({
  device,
  ...rest
}: DialogProps & { device: DeviceDto | null }) {
  if (!device) return null;
  return <DeleteDeviceInner key={device.id} device={device} {...rest} />;
}

function DeleteDeviceInner({
  device,
  api,
  onClose,
  onStale,
  onDone,
}: DialogProps & { device: DeviceDto }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const outcome = settleDelete(await api.remove(device.id));
    if (outcome.kind === "done") return onDone();
    setError(outcome.message);
    if (outcome.stale) onStale();
    setSubmitting(false);
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
      <DeleteDeviceBody device={device} />
    </EntityFormDialog>
  );
}
