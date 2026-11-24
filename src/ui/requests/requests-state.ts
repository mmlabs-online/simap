import {
  REQUEST_STATUSES,
  type RequestDto,
  type RequestListItemDto,
  type RequestStatus,
} from "@/lib/requests/types";
import { atLeastTier, type Tier } from "@/lib/tier";
import { apiErrorMessage } from "../copy/api";
import { requestsCopy } from "../copy/requests";
import type { ChipOption } from "../Chip";
import { formatAuditTime } from "../audit/audit-state";
import type { RequestsResult } from "./requests-api";

export type ListState<T = RequestListItemDto> = {
  status: "loading" | "error" | "ready";
  items: T[];
  nextCursor: string | null;
  loadingMore: boolean;
  errorCode: string | null;
};

/** Managers and Admins open the page (the API enforces it too). */
export function canViewApprovals(tier: Tier | null | undefined): boolean {
  return tier ? atLeastTier(tier, "manager") : false;
}

/** Exactly one known value is kept; anything else (none, unknown, duplicate) is the default, pending. */
export function parseStatusParam(values: string[]): RequestStatus {
  const [only] = values;
  return values.length === 1 && (REQUEST_STATUSES as readonly string[]).includes(only)
    ? (only as RequestStatus)
    : "pending";
}

/** The page URL for a status; the default (pending) keeps the URL clean. */
export function statusHref(pathname: string, status: RequestStatus): string {
  return status === "pending" ? pathname : `${pathname}?status=${status}`;
}

export function statusOptions(): ChipOption<RequestStatus>[] {
  return REQUEST_STATUSES.map((value) => ({ value, label: requestsCopy.statusLabel[value] }));
}

/** Appends a loaded page to the list and takes its cursor (null -> no more). */
export function appendPage<T>(
  state: ListState<T>,
  page: { items: T[]; nextCursor: string | null },
): ListState<T> {
  return {
    ...state,
    items: [...state.items, ...page.items],
    nextCursor: page.nextCursor,
    loadingMore: false,
  };
}

/** A stored UTC instant shown in Asia/Ho_Chi_Minh (D35). */
export const formatRequestTime = formatAuditTime;

const AUTH_CODES = ["unauthenticated", "forbidden", "member_deactivated", "org_required"];

export type CancelOutcome = {
  reload: boolean;
  notice: { tone: "status" | "error"; text: string };
};

/**
 * What My requests does after a cancel, from the result only. A cancel of a request a Manager decided first
 * is a server no-op that returns the current status. Auth codes and `invalid_request` mean nothing changed.
 */
export function cancelOutcome(result: RequestsResult<RequestDto>): CancelOutcome {
  if (result.ok) {
    const { status } = result.value;
    return {
      reload: true,
      notice: {
        tone: "status",
        text:
          status === "cancelled"
            ? requestsCopy.mine.cancelled
            : requestsCopy.mine.alreadyDecided(requestsCopy.statusLabel[status]),
      },
    };
  }
  const { code } = result;
  return {
    reload: !(AUTH_CODES.includes(code) || code === "invalid_request"),
    notice: { tone: "error", text: apiErrorMessage(code) },
  };
}
