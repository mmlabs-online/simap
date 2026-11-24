import type { RequestListItemDto } from "@/lib/requests/types";
import { requestsCopy } from "../copy/requests";
import { Button } from "../Button";
import type { DecisionAction } from "./requests-flow";
import { occupantHintId } from "./requests-state";

/** Approve and Reject for a pending row. They only open the dialog; the page makes the call. */
export function RequestRowActions({
  item,
  busy,
  onApprove,
  onReject,
}: {
  item: RequestListItemDto;
  busy: { id: string; action: DecisionAction } | null;
  onApprove: (item: RequestListItemDto) => void;
  onReject: (item: RequestListItemDto) => void;
}) {
  if (item.status !== "pending") return null;
  const d = requestsCopy.decision;
  const mine = busy?.id === item.id ? busy.action : null;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button
        variant="filled"
        size="sm"
        className="min-h-11"
        disabled={busy !== null || item.currentOccupant !== null}
        aria-describedby={item.currentOccupant ? occupantHintId(item.id) : undefined}
        onClick={() => onApprove(item)}
      >
        {mine === "approve" ? d.approving : d.approve}
      </Button>
      <Button
        variant="tonal"
        size="sm"
        className="min-h-11"
        disabled={busy !== null}
        onClick={() => onReject(item)}
      >
        {mine === "reject" ? d.rejecting : d.reject}
      </Button>
    </div>
  );
}
