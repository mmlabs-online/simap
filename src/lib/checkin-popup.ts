import type { CheckinInputs } from "@/lib/checkin-room";
import type { MyPresenceDto, MyPresenceResponse } from "@/lib/presence/types";

export type Load = "loading" | "ready" | "error";

/** PRE-02: the popup opens on arrival only for a member with a seat and no check-in today (any source). */
export function autoOpen(input: {
  seats: Load;
  seatCount: number;
  presence: Load;
  active: MyPresenceDto | null;
  seatPanelOpen: boolean;
}): boolean {
  return (
    input.seats === "ready" &&
    input.presence === "ready" &&
    input.active === null &&
    input.seatCount > 0 &&
    !input.seatPanelOpen
  );
}

export type PopupPhase = "pending" | "open" | "closed";
export type PopupEvent = "auto" | "skip" | "justLook" | "checkedIn" | "openFromButton";

/** Once per page load: `auto` and `skip` act only on `pending`, so a later check-out never reopens the popup. */
export function popupReducer(phase: PopupPhase, event: PopupEvent): PopupPhase {
  switch (event) {
    case "auto":
      return phase === "pending" ? "open" : phase;
    case "skip":
      return phase === "pending" ? "closed" : phase;
    case "justLook":
    case "checkedIn":
      return phase === "open" ? "closed" : phase;
    case "openFromButton":
      return "open";
  }
}

export type PopupSeatRoom = {
  roomId: string;
  code: string;
  name: string;
  seatCode: string;
  /** Members checked in now, null when unknown. */
  count: number | null;
  /** The member's last check-in to this room (ISO), null = never. */
  lastCheckedInAt: string | null;
};
export type PopupLockedRoom = { roomId: string; code: string; name: string };

/**
 * The popup rows. Seat rooms: most recent check-in first, then never-visited by code (as `firstRoom`); the seat
 * shown is the lowest `seq` in the room (D77). Locked: rooms without a seat, by code.
 */
export function popupRooms(input: {
  rooms: readonly { id: string; code: string; name: string }[];
  seats: readonly { roomId: string; roomCode: string; code: string; seq: number }[];
  recent: readonly { roomId: string; lastCheckedInAt: string }[];
  counts: Readonly<Record<string, number | null>>;
}): { seatRooms: PopupSeatRoom[]; locked: PopupLockedRoom[] } {
  const lowest = new Map<string, { roomCode: string; code: string; seq: number }>();
  for (const s of input.seats) {
    const cur = lowest.get(s.roomId);
    if (cur === undefined || s.seq < cur.seq) {
      lowest.set(s.roomId, { roomCode: s.roomCode, code: s.code, seq: s.seq });
    }
  }
  const last = new Map<string, { at: string; time: number }>();
  for (const r of input.recent) {
    const time = Date.parse(r.lastCheckedInAt);
    if (Number.isNaN(time)) continue;
    const cur = last.get(r.roomId);
    if (cur === undefined || time > cur.time) last.set(r.roomId, { at: r.lastCheckedInAt, time });
  }
  const nameOf = new Map(input.rooms.map((r) => [r.id, r.name]));

  const seatRooms: PopupSeatRoom[] = [...lowest].map(([roomId, s]) => ({
    roomId,
    code: s.roomCode,
    name: nameOf.get(roomId) ?? "",
    seatCode: s.code,
    count: input.counts[roomId] ?? null,
    lastCheckedInAt: last.get(roomId)?.at ?? null,
  }));
  const time = (r: PopupSeatRoom) =>
    r.lastCheckedInAt === null ? -1 : Date.parse(r.lastCheckedInAt);
  seatRooms.sort((a, b) => time(b) - time(a) || a.code.localeCompare(b.code));

  const locked = input.rooms
    .filter((r) => !lowest.has(r.id))
    .map((r) => ({ roomId: r.id, code: r.code, name: r.name }))
    .sort((a, b) => a.code.localeCompare(b.code));
  return { seatRooms, locked };
}

/** The radio selected on open: the shown room when it is a seat room, else the first seat row. */
export function initialSelection(
  seatRooms: readonly { code: string }[],
  shownCode: string | null,
): string | null {
  if (shownCode !== null && seatRooms.some((r) => r.code === shownCode)) return shownCode;
  return seatRooms[0]?.code ?? null;
}

export type ButtonAction =
  | { kind: "hidden" }
  | { kind: "retry" }
  | { kind: "checkout" }
  | { kind: "checkin"; roomId: string }
  | { kind: "openPopup" };

/** The floating button (PRE-01): never offers a check-in against unknown presence or without a seat. */
export function buttonAction(input: {
  presence: Load;
  seatCount: number;
  active: MyPresenceDto | null;
  seatRooms: readonly { roomId: string; code: string }[];
  shownCode: string | null;
}): ButtonAction {
  if (input.presence === "loading") return { kind: "hidden" };
  if (input.seatCount === 0) return { kind: "hidden" };
  if (input.presence === "error") return { kind: "retry" };
  if (input.active !== null) return { kind: "checkout" };
  const shown = input.seatRooms.find((r) => r.code === input.shownCode);
  return shown ? { kind: "checkin", roomId: shown.roomId } : { kind: "openPopup" };
}

/** What the flow does with a check-in answer. 409 means the member is checked in, so the popup closes. */
export function checkInOutcome(result: { ok: true } | { ok: false; code: string }): {
  close: boolean;
  refreshPresence: boolean;
  reloadSeats: boolean;
  errorCode: string | null;
} {
  if (result.ok) {
    return { close: true, refreshPresence: false, reloadSeats: false, errorCode: null };
  }
  if (result.code === "already_checked_in") {
    return { close: true, refreshPresence: true, reloadSeats: false, errorCode: null };
  }
  return {
    close: false,
    refreshPresence: false,
    reloadSeats: result.code === "no_seat_in_room",
    errorCode: result.code,
  };
}

/** The presence inputs of `firstRoom` (PRE-01); empty when presence is not loaded. */
export function firstRoomInputs(
  data: MyPresenceResponse | null,
): Pick<CheckinInputs, "activeCheckinRoom" | "recentCheckins"> {
  return {
    activeCheckinRoom: data?.presence?.roomCode ?? null,
    recentCheckins: (data?.recent ?? []).map((r) => ({
      roomCode: r.roomCode,
      at: r.lastCheckedInAt,
    })),
  };
}
