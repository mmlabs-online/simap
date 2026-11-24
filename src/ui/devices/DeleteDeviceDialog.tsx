"use client";

import { useState } from "react";
import type { DeviceDto } from "@/lib/devices/types";
import { devicesCopy } from "../copy/devices";
import { EntityFormDialog } from "../EntityFormDialog";
import {
  afterRefetch,
  deleteStep,
  deleteSubmitLabel,
  moveBody,
  settleDelete,
  settleMove,
  type DeleteStep,
} from "./delete-device-flow";
import type { DevicesApi } from "./devices-api";

const copy = devicesCopy.delete;

/** Props only: the warning for a placed device, or the delete confirmation. */
export function DeleteDeviceBody({
  device,
  step,
  moved,
}: {
  device: DeviceDto;
  step: DeleteStep;
  moved: boolean;
}) {
  return (
    <div className="text-sm font-medium text-on-surface flex flex-col gap-1">
      {step === "confirm" && moved && <p className="text-on-surface-variant">{copy.moved}</p>}
      <p>
        {step === "placed"
          ? copy.placedBody(device.name, device.inventoryNumber, device.placement?.seatCode ?? "")
          : copy.confirmBody(device.name, device.inventoryNumber)}
      </p>
    </div>
  );
}

type DialogProps = {
  api: DevicesApi;
  onClose: () => void;
  onStale: () => void;
  onDone: () => void;
};

/** Delete one device; a placed one is moved to inventory first. Mounted only while a device is set. */
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
  const [current, setCurrent] = useState(device);
  const [moved, setMoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const step = deleteStep(current);

  async function refetch() {
    const outcome = afterRefetch(await api.get(current.id));
    if (outcome.kind === "done") return onDone();
    if (outcome.kind === "device") {
      setCurrent(outcome.device);
      setMoved(false);
      onStale();
    }
    setSubmitting(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    if (step === "confirm") {
      const outcome = settleDelete(await api.remove(current.id));
      if (outcome.kind === "done") return onDone();
      setError(outcome.message);
      if (outcome.kind === "placed") return refetch();
    } else {
      const outcome = settleMove(await api.place(current.id, moveBody(current)));
      if (outcome.kind === "done") return onDone();
      if (outcome.kind === "confirm") {
        setCurrent(outcome.device);
        setMoved(true);
        onStale();
      } else {
        setError(outcome.message);
        if (outcome.kind === "refetch") return refetch();
      }
    }
    setSubmitting(false);
  }

  return (
    <EntityFormDialog
      open
      title={copy.title}
      subtitle={devicesCopy.typeLine(current.name, current.inventoryNumber)}
      submitLabel={deleteSubmitLabel(step)}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <DeleteDeviceBody device={current} step={step} moved={moved} />
    </EntityFormDialog>
  );
}
