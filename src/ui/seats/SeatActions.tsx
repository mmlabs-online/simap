import type { SeatDto } from "@/lib/seats/types";
import type { Tier } from "@/lib/tier";
import { seatsCopy } from "../copy/seats";
import { Button } from "../Button";
import { seatButtons } from "./seat-actions";

/** Panel actions. `seat` is the detail seat once it is ready, else `null` (no buttons). The notice shows in every view. */
export function SeatActions({
  tier,
  seat,
  notice,
  busy,
  onAssign,
  onDelete,
  onRelease,
  onRemove,
  onSetCannotSeat,
  onClearCannotSeat,
}: {
  tier: Tier | null | undefined;
  seat: SeatDto | null;
  notice: string | null;
  busy: boolean;
  onAssign: (seat: SeatDto) => void;
  onDelete: (seat: SeatDto) => void;
  onRelease: (seat: SeatDto) => void;
  onRemove: (seat: SeatDto) => void;
  onSetCannotSeat: (seat: SeatDto) => void;
  onClearCannotSeat: (seat: SeatDto) => void;
}) {
  const buttons = seat ? seatButtons(tier, seat) : null;
  return (
    <>
      {notice && (
        <p role="alert" className="text-sm font-semibold text-error">
          {notice}
        </p>
      )}
      {seat &&
        buttons &&
        (buttons.assign ||
          buttons.release ||
          buttons.removeOccupant ||
          buttons.setCannotSeat ||
          buttons.clearCannotSeat ||
          buttons.deleteSeat) && (
          <div className="flex flex-wrap gap-2">
            {buttons.assign && (
              <Button
                variant="tonal"
                disabled={busy || buttons.assignDisabled}
                onClick={() => onAssign(seat)}
              >
                {seatsCopy.actions[buttons.assign]}
              </Button>
            )}
            {buttons.release && (
              <Button variant="tonal" disabled={busy} onClick={() => onRelease(seat)}>
                {seatsCopy.actions.release}
              </Button>
            )}
            {buttons.removeOccupant && (
              <Button variant="danger" disabled={busy} onClick={() => onRemove(seat)}>
                {seatsCopy.actions.removeOccupant}
              </Button>
            )}
            {buttons.setCannotSeat && (
              <Button variant="tonal" disabled={busy} onClick={() => onSetCannotSeat(seat)}>
                {seatsCopy.actions.blockSeat}
              </Button>
            )}
            {buttons.clearCannotSeat && (
              <Button variant="tonal" disabled={busy} onClick={() => onClearCannotSeat(seat)}>
                {seatsCopy.actions.unblockSeat}
              </Button>
            )}
            {buttons.deleteSeat && (
              <Button variant="danger" disabled={busy} onClick={() => onDelete(seat)}>
                {seatsCopy.actions.delete}
              </Button>
            )}
          </div>
        )}
    </>
  );
}
