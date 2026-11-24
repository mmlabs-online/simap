import type { SeatDto } from "@/lib/seats/types";

export type TagSelection = { groupId: string | null; projectId: string | null };

export function initialSelection(seat: Pick<SeatDto, "group" | "project">): TagSelection {
  return { groupId: seat.group?.id ?? null, projectId: seat.project?.id ?? null };
}

/** Only the changed keys, or null when nothing changed (then nothing is sent). */
export function tagsPatch(
  seat: Pick<SeatDto, "group" | "project">,
  sel: TagSelection,
): { groupId?: string | null; projectId?: string | null } | null {
  const was = initialSelection(seat);
  const patch: { groupId?: string | null; projectId?: string | null } = {};
  if (sel.groupId !== was.groupId) patch.groupId = sel.groupId;
  if (sel.projectId !== was.projectId) patch.projectId = sel.projectId;
  return Object.keys(patch).length === 0 ? null : patch;
}

/** The list in its order; the seat's current tag stays selectable even if the list no longer has it. */
export function tagOptions<T extends { id: string }>(list: T[], current: T | null): T[] {
  return current && !list.some((x) => x.id === current.id) ? [...list, current] : list;
}

export type ListLoader<T> = () => Promise<{ ok: true; value: T[] } | { ok: false; code: string }>;
