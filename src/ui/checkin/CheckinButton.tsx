import type { ButtonAction } from "@/lib/checkin-popup";
import { Button } from "../Button";
import { apiErrorMessage } from "../copy/api";
import { checkinPopupCopy } from "../copy/checkin-popup";

export type CheckinButtonProps = {
  action: ButtonAction;
  busy: boolean;
  errorCode: string | null;
  onPress: () => void;
};

/** The floating Check in / Check out / Try again button (PRE-01). Pure; renders nothing when hidden. */
export function CheckinButton({ action, busy, errorCode, onPress }: CheckinButtonProps) {
  if (action.kind === "hidden") return null;
  const label =
    action.kind === "checkout"
      ? checkinPopupCopy.button.checkOut
      : action.kind === "retry"
        ? checkinPopupCopy.button.retry
        : checkinPopupCopy.button.checkIn;
  return (
    <span className="pointer-events-auto flex flex-col items-end gap-2">
      {errorCode !== null && (
        <span role="alert" className="text-label font-semibold text-danger">
          {apiErrorMessage(errorCode)}
        </span>
      )}
      <Button variant="pixel" onClick={onPress} disabled={busy} aria-busy={busy}>
        {label}
      </Button>
    </span>
  );
}
