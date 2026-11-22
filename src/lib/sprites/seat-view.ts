import type { SeatView } from "./layout";

/** Derived seat status (SEA-02), never stored. `pending` is not emitted until SIM-014. */
export function seatViewOf(s: {
  cannotSeat: boolean;
  mine: boolean;
  occupantId: string | null;
  occupantName: string | null;
}): SeatView {
  const state = s.cannotSeat
    ? "cannot"
    : s.mine
      ? "mine"
      : s.occupantId !== null
        ? "occupied"
        : "empty";
  return { state, avatarSeed: s.occupantId, name: s.occupantName };
}
