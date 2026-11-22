import type { SeatDto } from "@/lib/seats/types";
import type { Tier } from "@/lib/tier";
import { seatsCopy } from "../copy/seats";
import { Button } from "../Button";
import { canManageSeats, canRelease } from "./seat-actions";

/** Panel actions. `seat` is the detail seat once it is ready, else `null` (no buttons). The notice shows in every view. */
export function SeatActions({
  tier,
  seat,
  notice,
  busy,
  onDelete,
  onRelease,
}: {
  tier: Tier | null | undefined;
  seat: SeatDto | null;
  notice: string | null;
  busy: boolean;
  onDelete: (seat: SeatDto) => void;
  onRelease: (seat: SeatDto) => void;
}) {
  const release = seat !== null && canRelease(seat);
  const remove = seat !== null && canManageSeats(tier);
  return (
    <>
      {notice && (
        <p role="alert" className="text-sm font-semibold text-error">
          {notice}
        </p>
      )}
      {seat && (release || remove) && (
        <div className="flex flex-wrap gap-2">
          {release && (
            <Button variant="tonal" disabled={busy} onClick={() => onRelease(seat)}>
              {seatsCopy.actions.release}
            </Button>
          )}
          {remove && (
            <Button variant="danger" disabled={busy} onClick={() => onDelete(seat)}>
              {seatsCopy.actions.delete}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
