import type { DeleteImpact } from "./types";

/** ROO-01: a room is deleted without force only when no seat is occupied and no device is placed (Q4). */
export function canDeleteDirectly(impact: DeleteImpact): boolean {
  return impact.occupiedSeats === 0 && impact.placedDevices === 0;
}
