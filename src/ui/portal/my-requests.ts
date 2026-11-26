import type { IconName } from "@/lib/icons";
import type { MyRequestDto, RequestStatus } from "@/lib/requests/types";

export type MyRequestFilter = "all" | RequestStatus;

/** The filter segments, in display order. */
export const REQUEST_FILTERS = [
  "all",
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const satisfies readonly MyRequestFilter[];

/** Keeps the requests with the given status, in their original order. */
export function filterRequests(items: MyRequestDto[], filter: MyRequestFilter): MyRequestDto[] {
  return filter === "all" ? items : items.filter((it) => it.status === filter);
}

/** The icon and tone of a request status. */
export function requestStatusLook(status: RequestStatus): {
  icon: IconName;
  tone: "success" | "warning" | "danger" | "neutral";
} {
  switch (status) {
    case "approved":
      return { icon: "check", tone: "success" };
    case "pending":
      return { icon: "history", tone: "warning" };
    case "rejected":
      return { icon: "close", tone: "danger" };
    case "cancelled":
      return { icon: "block", tone: "neutral" };
  }
}

/** The loaded count; "+" while more pages exist. */
export function countLabel(count: number, hasMore: boolean): string {
  return `${count}${hasMore ? "+" : ""}`;
}
