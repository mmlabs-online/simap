"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeleteImpact, RoomDto } from "@/lib/rooms/types";
import { apiErrorMessage } from "../copy/api";
import { roomsCopy } from "../copy/rooms";
import { EntityFormDialog } from "../EntityFormDialog";
import { deleteStep, impactLines } from "./delete-flow";
import type { RoomsApi } from "./rooms-api";

/** Shows what deleting a room removes, then deletes (forced only after the explicit forced confirm). */
export function DeleteRoomDialog({
  room,
  api,
  onClose,
  onDone,
}: {
  room: RoomDto | null;
  api: RoomsApi;
  onClose: () => void;
  onDone: () => void;
}) {
  if (!room) return null;
  return <DeleteInner key={room.id} room={room} api={api} onClose={onClose} onDone={onDone} />;
}

function DeleteInner({
  room,
  api,
  onClose,
  onDone,
}: {
  room: RoomDto;
  api: RoomsApi;
  onClose: () => void;
  onDone: () => void;
}) {
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadImpact = useCallback(async () => {
    const r = await api.impact(room.id);
    if (r.ok) return setImpact(r.value);
    if (r.code === "not_found") return onDone();
    setError(apiErrorMessage(r.code));
  }, [api, room.id, onDone]);

  useEffect(() => {
    void loadImpact();
  }, [loadImpact]);

  const step = impact ? deleteStep(impact) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step) return;
    setError(null);
    setSubmitting(true);
    const r = await api.remove(room.id, step === "forced");
    setSubmitting(false);
    if (r.ok || r.code === "not_found") return onDone();
    if (r.code === "room_not_empty") return void loadImpact();
    setError(apiErrorMessage(r.code));
  }

  return (
    <EntityFormDialog
      open
      title={roomsCopy.deleteTitle}
      submitLabel={step === "forced" ? roomsCopy.forceDeleteSubmit : roomsCopy.deleteSubmit}
      submitting={submitting || !impact}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      {impact && (
        <div className="text-sm font-medium text-on-surface">
          {step === "forced" ? (
            <>
              <p>{roomsCopy.forceDeleteIntro(room.code)}</p>
              <ul className="list-disc pl-5 mt-1">
                {impactLines(impact).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>{roomsCopy.deleteBody(room.code)}</p>
          )}
        </div>
      )}
    </EntityFormDialog>
  );
}
