import { roomDetailHref } from "./nav";
import type { RoomDto } from "./rooms/types";

/** Room code from `/rooms/<code>` or `/rooms/<code>/edit`, left undecoded; null elsewhere. */
export function roomCodeFromPath(pathname: string): string | null {
  const m = /^\/rooms\/([^/]+)(?:\/edit)?$/.exec(pathname);
  return m ? m[1] : null;
}

/** Where Go navigates: null for an empty, current or dot target. */
export function goTarget(selected: string, current: string | null): string | null {
  if (!selected || selected === current) return null;
  return roomDetailHref(selected);
}

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
