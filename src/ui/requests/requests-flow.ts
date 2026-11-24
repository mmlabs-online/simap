import type { RequestDto, RequestListItemDto } from "@/lib/requests/types";
import { apiErrorMessage } from "../copy/api";
import { requestsCopy } from "../copy/requests";
import type { RequestsResult } from "./requests-api";

export type DecisionAction = "approve" | "reject";

export type DecisionOutcome = {
  close: boolean;
  reload: boolean;
  notice: { tone: "status" | "error"; text: string } | null;
  dialogError: string | null;
};

const REFUSALS = ["seat_taken", "seat_cannot_seat", "member_not_assignable"];

/**
 * What the Approvals page does after a decision, from the result only. A decision on a request that is no
 * longer pending is a server no-op that returns the current status.
 */
export function settleDecision(
  action: DecisionAction,
  result: RequestsResult<RequestDto>,
): DecisionOutcome {
  if (result.ok) {
    const { status } = result.value;
    const intended = action === "approve" ? "approved" : "rejected";
    return {
      close: true,
      reload: true,
      notice: {
        tone: "status",
        text:
          status === intended
            ? requestsCopy.decision[intended]
            : requestsCopy.mine.alreadyDecided(requestsCopy.statusLabel[status]),
      },
      dialogError: null,
    };
  }
  const { code } = result;
  if (code === "not_found") {
    return {
      close: true,
      reload: true,
      notice: { tone: "error", text: apiErrorMessage(code) },
      dialogError: null,
    };
  }
  return {
    close: false,
    reload: REFUSALS.includes(code),
    notice: null,
    dialogError: apiErrorMessage(code),
  };
}

/** Names of the other loaded pending requests for the same seat, in list order. */
export function rivalNames(items: RequestListItemDto[], target: RequestListItemDto): string[] {
  return items
    .filter((r) => r.status === "pending" && r.seat.id === target.seat.id && r.id !== target.id)
    .map((r) => r.subject.displayName);
}
