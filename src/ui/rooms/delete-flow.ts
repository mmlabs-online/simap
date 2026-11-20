import { canDeleteDirectly } from "@/lib/rooms/delete-impact";
import type { DeleteImpact } from "@/lib/rooms/types";
import { roomsCopy } from "../copy/rooms";

/** ROO-01: `plain` when the room is empty enough to delete directly, otherwise `forced` (explicit confirm). */
export function deleteStep(impact: DeleteImpact): "plain" | "forced" {
  return canDeleteDirectly(impact) ? "plain" : "forced";
}

/** One line per non-zero count, in the order seats, occupied seats, devices, requests. */
export function impactLines(impact: DeleteImpact): string[] {
  const lines: [number, (n: number) => string][] = [
    [impact.seats, roomsCopy.impactSeats],
    [impact.occupiedSeats, roomsCopy.impactOccupied],
    [impact.placedDevices, roomsCopy.impactDevices],
    [impact.pendingRequests, roomsCopy.impactRequests],
  ];
  return lines.filter(([n]) => n > 0).map(([n, text]) => text(n));
}
