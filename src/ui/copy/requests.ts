import type { RequestStatus } from "@/lib/requests/types";

/** English strings of the Approvals page (D36). API error messages come from `apiErrorMessage`. */
export const requestsCopy = {
  filterLabel: "Status",
  statusLabel: {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled",
  } satisfies Record<RequestStatus, string>,
  emptyFor: {
    pending: "No pending requests.",
    approved: "No approved requests.",
    rejected: "No rejected requests.",
    cancelled: "No cancelled requests.",
  } satisfies Record<RequestStatus, string>,
  summary: (count: number, hasMore: boolean) =>
    `${count}${hasMore ? "+" : ""} ${count === 1 && !hasMore ? "request" : "requests"}`,
  seatLine: (seatCode: string, roomCode: string) => `Seat ${seatCode} in room ${roomCode}`,
  requestedAt: (time: string) => `Requested ${time}`,
  occupiedBy: (name: string) => `Seat is occupied by ${name}`,
  seatEmpty: "Seat is empty",
  decidedLine: (status: RequestStatus, by: string | null, time: string) =>
    `${requestsCopy.statusLabel[status]}${by === null ? "" : ` by ${by}`} on ${time}`,
  loadMore: "Load more",
  loadingMore: "Loading...",
  retry: "Try again",
  mine: {
    empty: "You have no seat requests yet. Open a room and choose an empty seat to request it.",
    cancel: "Cancel request",
    cancelling: "Cancelling...",
    cancelled: "Request cancelled.",
    alreadyDecided: (status: string) => `This request was already ${status.toLowerCase()}.`,
    listLabel: "My seat requests",
    newChip: "New",
  },
  decision: {
    approve: "Approve",
    reject: "Reject",
    approving: "Approving...",
    rejecting: "Rejecting...",
    approveTitle: "Approve request?",
    rejectTitle: "Reject request?",
    keepPending: "Keep pending",
    approveBody: (requester: string, seat: string, room: string) =>
      `Assign ${requester} to seat ${seat} in room ${room}.`,
    rivalsLine: (names: string[], more: number, partial: boolean) => {
      const list = `${names.join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
      return partial
        ? `Approving also rejects other pending requests for this seat, including ${list}.`
        : `Approving rejects the other pending requests for this seat (${list}).`;
    },
    rejectBody: (requester: string, seat: string, room: string) =>
      `Reject ${requester}'s request for seat ${seat} in room ${room}? They will see the decision in My requests.`,
    approved: "Request approved.",
    rejected: "Request rejected.",
  },
  noAccess: "Only managers and admins can review seat requests.",
} as const;
