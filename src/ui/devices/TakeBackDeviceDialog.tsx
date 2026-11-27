"use client";

import { useState } from "react";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { EntityFormDialog } from "../EntityFormDialog";
import type { DevicesApi } from "./devices-api";
import { settleTakeBack, takeBackBody } from "./return-device";

const copy = devicesCopy.takeBack;

/** Props only: who has the device, where it sits and what taking it back does. */
export function TakeBackDeviceBody({ device }: { device: DeviceDto }) {
  const { owner, seat, cancelsTransfer } = takeBackBody(device);
  return (
    <div className="flex flex-col gap-1 text-label text-text-primary">
      <p>
        {copy.withOwner(owner)}, {seat === null ? copy.notPlaced : copy.onSeat(seat)}.
      </p>
      <p>{copy.effect}</p>
      {cancelsTransfer && <p>{copy.cancelsTransfer}</p>}
    </div>
  );
}

type DialogProps = {
  api: DevicesApi;
  onClose: () => void;
  onStale: () => void;
  onDone: (device: DeviceDto) => void;
};

/** An Admin takes an owned device back to the org inventory. Mounted only while a device is set. */
export function TakeBackDeviceDialog({
  device,
  ...rest
}: DialogProps & { device: DeviceDto | null }) {
  if (!device) return null;
  return <TakeBackInner key={device.id} device={device} {...rest} />;
}

function TakeBackInner({
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
    const outcome = settleTakeBack(await api.takeBack(device.id));
    if (outcome.kind === "done") return onDone(device);
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
      <TakeBackDeviceBody device={device} />
    </EntityFormDialog>
  );
}
