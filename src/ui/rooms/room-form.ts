import {
  validateRoomCreate,
  validateRoomPatch,
  type RoomCreateValue,
  type RoomPatchValue,
} from "@/lib/validate/room";
import type { RoomDto } from "@/lib/rooms/types";
import { roomsCopy } from "../copy/rooms";

export type RoomForm = { code: string; name: string; description: string; floor: string };

/** Q22: the code input uppercases as the user types; trimming is the validator's job. */
export const codeInput = (raw: string): string => raw.toUpperCase();

export const emptyForm = (): RoomForm => ({ code: "", name: "", description: "", floor: "" });

export const formFromRoom = (room: RoomDto): RoomForm => ({
  code: room.code,
  name: room.name,
  description: room.description ?? "",
  floor: room.floor ?? "",
});

export function fieldMessage(field: string): string {
  const messages: Record<string, string> = roomsCopy.fieldErrors;
  return messages[field] ?? roomsCopy.fieldErrors.body;
}

export type CreateResult =
  | { kind: "ok"; body: RoomCreateValue }
  | { kind: "invalid"; message: string };

export function toCreateBody(form: RoomForm): CreateResult {
  const v = validateRoomCreate(form);
  return v.ok ? { kind: "ok", body: v.value } : { kind: "invalid", message: fieldMessage(v.field) };
}

export type PatchResult =
  | { kind: "ok"; body: RoomPatchValue }
  | { kind: "unchanged" }
  | { kind: "invalid"; message: string };

const FIELDS = ["code", "name", "description", "floor"] as const;

/** Sends only the fields that changed; a code that differs only by case or spaces is unchanged. */
export function toPatchBody(form: RoomForm, room: RoomDto): PatchResult {
  const original = formFromRoom(room);
  const changed: Partial<RoomForm> = {};
  for (const f of FIELDS) {
    const same =
      f === "code"
        ? form.code.trim().toUpperCase() === original.code
        : form[f].trim() === original[f];
    if (!same) changed[f] = form[f];
  }
  if (Object.keys(changed).length === 0) return { kind: "unchanged" };
  const v = validateRoomPatch(changed);
  return v.ok ? { kind: "ok", body: v.value } : { kind: "invalid", message: fieldMessage(v.field) };
}

/** The rename warning for edit mode when the typed code differs from the original and is valid. */
export function renameWarningFor(
  mode: "create" | "edit",
  originalCode: string,
  typedCode: string,
): string | null {
  if (mode !== "edit") return null;
  const v = validateRoomPatch({ code: typedCode });
  if (!v.ok || v.value.code === undefined || v.value.code === originalCode.toUpperCase())
    return null;
  return roomsCopy.renameWarning(originalCode, v.value.code);
}
