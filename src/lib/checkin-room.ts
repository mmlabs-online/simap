export type CheckinInputs = {
  /** Room of today's active check-in (supplied by SIM-058). */
  activeCheckinRoom: string | null;
  /** Past check-ins with ISO timestamps. */
  recentCheckins: readonly { roomCode: string; at: string }[];
  /** Rooms where the member has a seat. */
  seatRoomCodes: readonly string[];
};

export type FirstRoom = { kind: "room"; code: string } | { kind: "noSeat" };
export type ShownRoom = { kind: "loading" } | FirstRoom;

/** PRE-01: today's active check-in, else the most recent check-in where a seat is held, else the lowest seat room code. */
export function firstRoom(input: CheckinInputs): FirstRoom {
  if (input.activeCheckinRoom !== null) return { kind: "room", code: input.activeCheckinRoom };
  const seatRooms = new Set(input.seatRoomCodes);
  const recent = input.recentCheckins
    .map((c) => ({ roomCode: c.roomCode, time: Date.parse(c.at) }))
    .filter((c) => !Number.isNaN(c.time) && seatRooms.has(c.roomCode))
    .sort((a, b) => b.time - a.time || a.roomCode.localeCompare(b.roomCode));
  if (recent.length > 0) return { kind: "room", code: recent[0].roomCode };
  const lowest = [...seatRooms].sort((a, b) => a.localeCompare(b))[0];
  return lowest === undefined ? { kind: "noSeat" } : { kind: "room", code: lowest };
}

/** The room to show: a requested code in the room list wins, else the first room; loading until the needed list is ready. */
export function shownRoom(input: {
  requested: string | null;
  roomCodes: readonly string[] | null;
  first: FirstRoom | null;
}): ShownRoom {
  if (input.requested !== null) {
    if (input.roomCodes === null) return { kind: "loading" };
    if (input.roomCodes.includes(input.requested)) return { kind: "room", code: input.requested };
  }
  return input.first ?? { kind: "loading" };
}
