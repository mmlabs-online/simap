import {
  REQUEST_STATUSES,
  type RequestListItemDto,
  type RequestStatus,
} from "@/lib/requests/types";
import { atLeastTier, type Tier } from "@/lib/tier";
import { requestsCopy } from "../copy/requests";
import type { ChipOption } from "../Chip";
import { formatAuditTime } from "../audit/audit-state";

export type ListState = {
  status: "loading" | "error" | "ready";
  items: RequestListItemDto[];
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
export function appendPage(
  state: ListState,
  page: { items: RequestListItemDto[]; nextCursor: string | null },
): ListState {
  return {
    ...state,
    items: [...state.items, ...page.items],
    nextCursor: page.nextCursor,
    loadingMore: false,
  };
}

/** A stored UTC instant shown in Asia/Ho_Chi_Minh (D35). */
export const formatRequestTime = formatAuditTime;
