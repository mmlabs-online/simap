import type { RequestStatus } from "./types";

export type RequestAction = "approve" | "reject" | "cancel";

const TARGET: Record<RequestAction, RequestStatus> = {
  approve: "approved",
  reject: "rejected",
  cancel: "cancelled",
};

/** REG-02: only a pending request changes; terminal states never do. Null means no-op. */
export const nextStatus = (status: RequestStatus, action: RequestAction): RequestStatus | null =>
  status === "pending" ? TARGET[action] : null;

/** REG-01 / SEA-01: occupied is checked before cannot-seat so one code answers when both apply. */
export function decideCreate(a: {
  occupantId: string | null;
  cannotSeat: boolean;
}): "create" | "refuse_taken" | "refuse_cannot_seat" {
  if (a.occupantId !== null) return "refuse_taken";
  return a.cannotSeat ? "refuse_cannot_seat" : "create";
}

/** REG-02: a non-pending request is a no-op first; an approval never replaces an occupant (D18). */
export function decideApprove(a: {
  status: RequestStatus;
  occupantId: string | null;
  cannotSeat: boolean;
}): "noop" | "approve" | "refuse_taken" | "refuse_cannot_seat" {
  if (nextStatus(a.status, "approve") === null) return "noop";
  if (a.occupantId !== null) return "refuse_taken";
  return a.cannotSeat ? "refuse_cannot_seat" : "approve";
}

/** D24: only the requester cancels; cancelling a non-pending request is a no-op. */
export function decideCancel(a: {
  status: RequestStatus;
  isOwner: boolean;
}): "refuse" | "noop" | "cancel" {
  if (!a.isOwner) return "refuse";
  return nextStatus(a.status, "cancel") === null ? "noop" : "cancel";
}

/** D24 badge: a decision is unseen when it is approved or rejected after `seenAt` (null = never seen). Both are µs ISO strings. */
export const isUnseen = (
  status: RequestStatus,
  decidedAt: string | null,
  seenAt: string | null,
): boolean =>
  (status === "approved" || status === "rejected") &&
  decidedAt !== null &&
  (seenAt === null || decidedAt > seenAt);
