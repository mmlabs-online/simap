import type { IconName } from "@/lib/icons";
import type { RoomDto } from "@/lib/rooms/types";
import type { SeatDeviceDto, SeatDto, SeatStatus } from "@/lib/seats/types";
import { ROOM_LIMITS } from "@/lib/validate/room";

export type SeatParam = { kind: "none" } | { kind: "invalid" } | { kind: "code"; code: string };

const SEAT_CODE_RE = new RegExp(`^[A-Z0-9._-]{1,${ROOM_LIMITS.code}}-\\d{2,10}$`);

/** Reads `searchParams.getAll("seat")`. An invalid value is never echoed back. */
export function parseSeatParam(values: string[]): SeatParam {
  if (values.length === 0) return { kind: "none" };
  if (values.length > 1) return { kind: "invalid" };
  const v = values[0];
  if (v.trim() === "") return { kind: "none" };
  return SEAT_CODE_RE.test(v) ? { kind: "code", code: v } : { kind: "invalid" };
}

/** The page URL with `?seat=<code>`, or the bare path when no seat is given. */
export function seatHref(pathname: string, seatCode: string | null): string {
  return seatCode === null ? pathname : `${pathname}?seat=${encodeURIComponent(seatCode)}`;
}

export type RoomsState = {
  status: "loading" | "error" | "ready";
  rooms: RoomDto[];
  errorCode: string | null;
};
export type RoomResolution =
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | { kind: "found"; room: RoomDto }
  | { kind: "missing" };

/** Resolves the URL's room code against the room list. Exact match only; a failed load is not "missing". */
export function resolveRoom(state: RoomsState, roomCode: string): RoomResolution {
  if (state.status === "loading") return { kind: "loading" };
  if (state.status === "error") return { kind: "error", code: state.errorCode ?? "internal" };
  const room = state.rooms.find((r) => r.code === roomCode);
  return room ? { kind: "found", room } : { kind: "missing" };
}

/** Status comes from the occupant (SEA-02); cannot-seat is shown on top of it (D26). */
export function statusView(seat: { status: SeatStatus; cannotSeat: boolean }): {
  state: SeatStatus;
  icon: IconName;
  blocked: boolean;
} {
  return {
    state: seat.status,
    icon: seat.status === "occupied" ? "person" : "event_seat",
    blocked: seat.cannotSeat,
  };
}

/** Device names in the list row. The list carries at most 20 per seat, so "more" uses `deviceCount`. */
export function deviceSummary(seat: Pick<SeatDto, "deviceCount" | "devices">): {
  names: string[];
  more: number;
} {
  return {
    names: seat.devices.map((d) => d.name),
    more: Math.max(0, seat.deviceCount - seat.devices.length),
  };
}

export function splitDevices(devices: SeatDeviceDto[]): {
  primary: SeatDeviceDto | null;
  secondary: SeatDeviceDto[];
} {
  return {
    primary: devices.find((d) => d.role === "primary") ?? null,
    secondary: devices.filter((d) => d.role === "secondary"),
  };
}

export type SeatListState = {
  status: "loading" | "error" | "ready";
  seats: SeatDto[];
  truncated: boolean;
  errorCode: string | null;
};
export type SeatDetailState = {
  seatId: string | null;
  status: "loading" | "error" | "ready";
  seat: SeatDto | null;
  errorCode: string | null;
};

export type PanelView =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "notFound"; truncated: boolean }
  | { kind: "error"; code: string }
  | { kind: "ready"; seat: SeatDto };

/** What the panel shows for the URL's seat. A detail that belongs to another seat is never shown. */
export function panelView(
  param: SeatParam,
  list: SeatListState,
  detail: SeatDetailState,
): PanelView {
  if (param.kind === "none") return { kind: "closed" };
  if (param.kind === "invalid") return { kind: "notFound", truncated: false };
  if (list.status === "error") return { kind: "error", code: list.errorCode ?? "internal" };
  const row = list.seats.find((s) => s.code === param.code);
  if (!row) {
    return list.status === "loading"
      ? { kind: "loading" }
      : { kind: "notFound", truncated: list.truncated };
  }
  if (detail.seatId !== row.id) return { kind: "loading" };
  if (detail.status === "error") {
    return detail.errorCode === "not_found"
      ? { kind: "notFound", truncated: false }
      : { kind: "error", code: detail.errorCode ?? "internal" };
  }
  if (detail.status === "ready" && detail.seat && detail.seat.id === row.id) {
    return { kind: "ready", seat: detail.seat };
  }
  return { kind: "loading" };
}
