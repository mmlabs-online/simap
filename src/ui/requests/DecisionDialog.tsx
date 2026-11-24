import type { RequestListItemDto } from "@/lib/requests/types";
import { requestsCopy } from "../copy/requests";
import { EntityFormDialog } from "../EntityFormDialog";
import type { DecisionAction } from "./requests-flow";

export type DecisionTarget = {
  item: RequestListItemDto;
  action: DecisionAction;
  /** Names of the other loaded pending requests for the seat. */
  rivals: string[];
  /** More pages exist, so `rivals` may be incomplete. */
  partial: boolean;
};

const MAX_NAMES = 3;

/** Confirm dialog for Approve and Reject. Pure: the page owns state and the API call. */
export function DecisionDialog({
  target,
  submitting,
  error,
  onClose,
  onConfirm,
}: {
  target: DecisionTarget | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (target === null) return null;
  const { item, action, rivals, partial } = target;
  const d = requestsCopy.decision;
  const who = item.subject.displayName;
  const approve = action === "approve";
  return (
    <EntityFormDialog
      key={`${item.id}:${action}`}
      open
      title={approve ? d.approveTitle : d.rejectTitle}
      submitLabel={approve ? d.approve : d.reject}
      cancelLabel={d.keepPending}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm();
      }}
    >
      <p className="text-sm break-words">
        {(approve ? d.approveBody : d.rejectBody)(who, item.seat.code, item.seat.roomCode)}
      </p>
      {approve && rivals.length > 0 && (
        <p className="text-sm break-words">
          {d.rivalsLine(
            rivals.slice(0, MAX_NAMES),
            Math.max(0, rivals.length - MAX_NAMES),
            partial,
          )}
        </p>
      )}
    </EntityFormDialog>
  );
}
