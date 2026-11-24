"use client";

import { useState } from "react";
import { seatsCopy } from "../copy/seats";
import { DialogField, EntityFormDialog } from "../EntityFormDialog";
import { parseAddCount } from "./seat-actions";

/** Count field for adding seats. An invalid count shows a field error and sends nothing. */
export function AddSeatsDialog({
  open,
  submitting,
  onClose,
  onAdd,
}: {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onAdd: (count: number) => void;
}) {
  if (!open) return null;
  return <AddInner submitting={submitting} onClose={onClose} onAdd={onAdd} />;
}

function AddInner({
  submitting,
  onClose,
  onAdd,
}: {
  submitting: boolean;
  onClose: () => void;
  onAdd: (count: number) => void;
}) {
  const [raw, setRaw] = useState("1");
  const [invalid, setInvalid] = useState(false);

  return (
    <EntityFormDialog
      open
      title={seatsCopy.actions.addTitle}
      submitLabel={seatsCopy.actions.addSubmit}
      submitting={submitting}
      error={invalid ? seatsCopy.actions.addInvalid : null}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = parseAddCount(raw);
        setInvalid(!parsed.ok);
        if (parsed.ok) onAdd(parsed.count);
      }}
    >
      <DialogField
        label={seatsCopy.actions.addCount}
        icon="event_seat"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={raw}
        aria-invalid={invalid}
        onChange={(e) => setRaw(e.target.value)}
      />
    </EntityFormDialog>
  );
}
