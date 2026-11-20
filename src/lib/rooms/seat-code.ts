/**
 * Seat codes are `<room code>-<NN>` (ROO-02). The room code passed in is already normalised (uppercase).
 * D30: next = seat_counter + 1, never max(seq) + 1 (spec ROO-02 wording superseded by the counter).
 */
export function formatSeatCode(roomCode: string, seq: number): string {
  if (!Number.isInteger(seq) || seq < 1)
    throw new RangeError("seat seq must be a positive integer");
  return `${roomCode}-${String(seq).padStart(2, "0")}`;
}

export function nextSeatSeq(counter: number): number {
  if (!Number.isInteger(counter) || counter < 0) {
    throw new RangeError("seat counter must be a non-negative integer");
  }
  return counter + 1;
}

/** New codes for every seat of a renamed room, derived from seq (never by string replace). */
export function renameSeatCodes(
  newRoomCode: string,
  seats: readonly { id: string; seq: number }[],
): { id: string; code: string }[] {
  return seats.map((s) => ({ id: s.id, code: formatSeatCode(newRoomCode, s.seq) }));
}
