"use client";

import { useState } from "react";
import type { SeatDto } from "@/lib/seats/types";
import { seatsCopy } from "../copy/seats";
import { DialogField, EntityFormDialog } from "../EntityFormDialog";
import { parseCannotSeatReason } from "./seat-actions";

/** Reason field for blocking a seat. An invalid reason shows a field error and sends nothing. `seat` null means closed. */
export function CannotSeatDialog({
  seat,
  submitting,
  onClose,
  onSubmit,
}: {
  seat: SeatDto | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  if (seat === null) return null;
  return (
    <CannotSeatInner seat={seat} submitting={submitting} onClose={onClose} onSubmit={onSubmit} />
  );
}

function CannotSeatInner({
  seat,
  submitting,
  onClose,
  onSubmit,
}: {
  seat: SeatDto;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [raw, setRaw] = useState("");
  const [invalid, setInvalid] = useState(false);

  return (
    <EntityFormDialog
      open
      title={seatsCopy.actions.blockTitle(seat.code)}
      subtitle={seat.occupant ? seatsCopy.actions.blockOccupantNote : undefined}
      submitLabel={seatsCopy.actions.blockSubmit}
      submitting={submitting}
      error={invalid ? seatsCopy.actions.blockInvalid : null}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = parseCannotSeatReason(raw);
        setInvalid(!parsed.ok);
        if (parsed.ok) onSubmit(parsed.reason);
      }}
    >
      <DialogField
        label={seatsCopy.actions.blockReason}
        icon="block"
        type="text"
        autoComplete="off"
        value={raw}
        aria-invalid={invalid}
        onChange={(e) => setRaw(e.target.value)}
      />
    </EntityFormDialog>
  );
}
