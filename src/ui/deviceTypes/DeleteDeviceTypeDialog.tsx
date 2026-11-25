"use client";

import { useState } from "react";
import type { DeviceTypeDto } from "@/lib/device-types/types";
import { deviceTypesCopy } from "../copy/deviceTypes";
import { EntityFormDialog } from "../EntityFormDialog";
import type { DeviceTypesApi } from "./device-types-api";
import { settleDelete } from "./device-types-state";

const copy = deviceTypesCopy.deleteDialog;

/** The confirm text. Props only, so the markup can be tested without effects. */
export function DeleteDeviceTypeBody({ name }: { name: string }) {
  return (
    <div className="text-sm font-medium text-on-surface">
      <p>{copy.body(name)}</p>
    </div>
  );
}

/** Confirms, then deletes the type. Closes itself through `onDone`. */
export function DeleteDeviceTypeDialog({
  item,
  api,
  onClose,
  onDone,
}: {
  item: DeviceTypeDto;
  api: DeviceTypesApi;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const settled = settleDelete(await api.remove(item.id));
    setSubmitting(false);
    if (settled.kind === "done") return onDone();
    setError(settled.message);
  }

  return (
    <EntityFormDialog
      open
      title={copy.title}
      submitLabel={copy.confirm}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <DeleteDeviceTypeBody name={item.name} />
    </EntityFormDialog>
  );
}
