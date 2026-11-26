import type { SeatView } from "./layout";
import { parsePixelLook } from "./pixel-look";

/** Derived seat status (SEA-02), never stored. `pending` is not emitted until SIM-014. */
export function seatViewOf(s: {
  cannotSeat: boolean;
  mine: boolean;
  occupantId: string | null;
  occupantName: string | null;
  occupantLook: unknown;
}): SeatView {
  const state = s.cannotSeat
    ? "cannot"
    : s.mine
      ? "mine"
      : s.occupantId !== null
        ? "occupied"
        : "empty";
  return {
    state,
    avatarSeed: s.occupantId,
    name: s.occupantName,
    look: s.occupantId !== null ? parsePixelLook(s.occupantLook) : null,
  };
}
