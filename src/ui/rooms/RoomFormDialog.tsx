"use client";

import { useState } from "react";
import type { RoomDto } from "@/lib/rooms/types";
import { apiErrorMessage } from "../copy/api";
import { kitCopy } from "../copy/kit";
import { roomsCopy } from "../copy/rooms";
import { DialogField, EntityFormDialog } from "../EntityFormDialog";
import {
  codeInput,
  emptyForm,
  formFromRoom,
  renameWarningFor,
  toCreateBody,
  toPatchBody,
  type RoomForm,
} from "./room-form";
import type { RoomsApi } from "./rooms-api";

/** Create (`room` null) or edit one room. Closes itself through `onDone` after a saved change. */
export function RoomFormDialog({
  open,
  room,
  api,
  onClose,
  onDone,
}: {
  open: boolean;
  room: RoomDto | null;
  api: RoomsApi;
  onClose: () => void;
  onDone: () => void;
}) {
  if (!open) return null;
  return (
    <RoomFormInner
      key={room?.id ?? "new"}
      room={room}
      api={api}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

function RoomFormInner({
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
  const [form, setForm] = useState<RoomForm>(room ? formFromRoom(room) : emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (key: keyof RoomForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let result;
    if (room) {
      const patch = toPatchBody(form, room);
      if (patch.kind === "unchanged") return onClose();
      if (patch.kind === "invalid") return setError(patch.message);
      setSubmitting(true);
      result = await api.update(room.id, patch.body);
    } else {
      const create = toCreateBody(form);
      if (create.kind === "invalid") return setError(create.message);
      setSubmitting(true);
      result = await api.create(create.body);
    }
    setSubmitting(false);
    if (result.ok) return onDone();
    if (result.code === "not_found") return onDone();
    setError(apiErrorMessage(result.code));
  }

  return (
    <EntityFormDialog
      open
      title={room ? roomsCopy.editTitle : roomsCopy.createTitle}
      subtitle={
        renameWarningFor(room ? "edit" : "create", room?.code ?? "", form.code) ?? undefined
      }
      submitLabel={room ? kitCopy.save : roomsCopy.create}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={submit}
    >
      <DialogField
        label={roomsCopy.fields.code}
        icon="grid_view"
        value={form.code}
        onChange={(e) => set("code", codeInput(e.target.value))}
        autoCapitalize="characters"
        spellCheck={false}
        autoComplete="off"
        required
      />
      <DialogField
        label={roomsCopy.fields.name}
        icon="meeting_room"
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        autoComplete="off"
        required
      />
      <DialogField
        label={roomsCopy.fields.description}
        icon="edit_square"
        value={form.description}
        onChange={(e) => set("description", e.target.value)}
        autoComplete="off"
      />
      <DialogField
        label={roomsCopy.fields.floor}
        icon="lan"
        value={form.floor}
        onChange={(e) => set("floor", e.target.value)}
        autoComplete="off"
      />
    </EntityFormDialog>
  );
}
