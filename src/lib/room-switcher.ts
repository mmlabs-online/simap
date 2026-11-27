import type { RoomDto } from "./rooms/types";
import { ROOM_LIMITS } from "./validate/room";

/** Keeps the previous list unless the new load is ready. */
export function keepGoodRooms(
  prev: RoomDto[],
  status: "loading" | "error" | "ready",
  rooms: RoomDto[],
): RoomDto[] {
  return status === "ready" ? rooms : prev;
}

/** The selection the select can show: the code if listed, else empty. */
export function visibleSelection(rooms: RoomDto[], selected: string): string {
  return rooms.some((r) => r.code === selected) ? selected : "";
}

const QUERY_ROOM_RE = new RegExp(`^[A-Z0-9._-]{1,${ROOM_LIMITS.code}}$`);

/** Reads `searchParams.getAll("room")`; null unless exactly one valid code (an invalid value is never echoed). */
export function roomCodeFromQuery(values: string[]): string | null {
  return values.length === 1 && QUERY_ROOM_RE.test(values[0]) ? values[0] : null;
}

/** The check-in view URL with optional `?room=` and `?seat=`. */
export function checkinRoomHref(
  pathname: string,
  room: string | null,
  seat: string | null,
): string {
  const q = new URLSearchParams();
  if (room !== null) q.set("room", room);
  if (seat !== null) q.set("seat", seat);
  const s = q.toString();
  return s ? `${pathname}?${s}` : pathname;
}

/** Where Go navigates in the check-in view: null for an empty or current selection. */
export function checkinGoTarget(
  pathname: string,
  selected: string,
  current: string | null,
): string | null {
  if (!selected || selected === current) return null;
  return checkinRoomHref(pathname, selected, null);
}
