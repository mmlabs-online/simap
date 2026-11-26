import type { MyRequestDto } from "@/lib/requests/types";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import { requestsCopy } from "../copy/requests";
import { shellCopy } from "../copy/shell";
import { Button } from "../Button";
import { Card } from "../Card";
import { Chip } from "../Chip";
import { formatRequestTime } from "./requests-state";

export type MyRequestsViewProps = {
  state: "loading" | "error" | "ready";
  items: MyRequestDto[];
  /** Ids to mark "New" for this visit. The view never reads `item.isNew`, so the mark survives a reload. */
  newIds: ReadonlySet<string>;
  hasMore: boolean;
  loadingMore: boolean;
  errorCode: string | null;
  cancellingId: string | null;
  notice: { tone: "status" | "error"; text: string } | null;
  onRetry: () => void;
  onLoadMore: () => void;
  onCancel: (item: MyRequestDto) => void;
  /** Inside a tab: an h2 and no page padding. */
  embedded?: boolean;
  /** Render nothing while ready and empty (the parent shows the one empty state). */
  hideEmpty?: boolean;
};

/** The My requests page body. Pure: data and handlers come from props. */
export function MyRequestsView({
  state,
  items,
  newIds,
  hasMore,
  loadingMore,
  errorCode,
  cancellingId,
  notice,
  onRetry,
  onLoadMore,
  onCancel,
  embedded = false,
  hideEmpty = false,
}: MyRequestsViewProps) {
  if (hideEmpty && state === "ready" && items.length === 0) return null;
  return (
    <div className={embedded ? "flex flex-col gap-4" : "p-4 lg:p-6 flex flex-col gap-4"}>
      {embedded ? (
        <h2 className="text-lg font-extrabold text-on-surface">
          {portalCopy.seat.requestsHeading}
        </h2>
      ) : (
        <h1 className="text-h2 font-extrabold text-on-surface">
          {shellCopy.pages.myRequests.title}
        </h1>
      )}

      {notice &&
        (notice.tone === "error" ? (
          <p role="alert" className="text-sm font-semibold text-error">
            {notice.text}
          </p>
        ) : (
          <p role="status" className="text-sm font-semibold text-on-surface">
            {notice.text}
          </p>
        ))}

      {state === "loading" && (
        <Card className="h-40 animate-pulse">
          <div aria-busy="true" className="h-full" />
        </Card>
      )}

      {state === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-sm font-semibold text-error">
            {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {requestsCopy.retry}
          </Button>
        </Card>
      )}

      {state === "ready" && items.length === 0 && (
        <Card className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-on-surface-variant">{requestsCopy.mine.empty}</p>
        </Card>
      )}

      {state === "ready" && items.length > 0 && (
        <ul aria-label={requestsCopy.mine.listLabel} className="grid gap-3">
          {items.map((it) => (
            <li key={it.id}>
              <Card className="flex min-w-0 flex-col gap-1 break-words p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-on-surface">
                    {requestsCopy.seatLine(it.seat.code, it.seat.roomCode)}
                  </span>
                  <Chip label={requestsCopy.statusLabel[it.status]} />
                  {newIds.has(it.id) && (
                    <Chip
                      label={requestsCopy.mine.newChip}
                      color="var(--primary-container)"
                      onColor="var(--on-primary-container)"
                    />
                  )}
                </div>
                <p className="text-xs text-on-surface-variant">
                  <time dateTime={it.createdAt}>
                    {requestsCopy.requestedAt(formatRequestTime(it.createdAt))}
                  </time>
                </p>
                {it.status !== "pending" && it.decidedAt !== null && (
                  <p className="text-xs text-on-surface-variant">
                    <time dateTime={it.decidedAt}>
                      {requestsCopy.decidedLine(
                        it.status,
                        it.decidedBy?.displayName ?? null,
                        formatRequestTime(it.decidedAt),
                      )}
                    </time>
                  </p>
                )}
                {it.status === "pending" && (
                  <div>
                    <Button
                      variant="tonal"
                      size="sm"
                      className="min-h-11"
                      disabled={cancellingId !== null}
                      onClick={() => onCancel(it)}
                    >
                      {cancellingId === it.id
                        ? requestsCopy.mine.cancelling
                        : requestsCopy.mine.cancel}
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {state === "ready" && hasMore && (
        <div>
          <Button variant="tonal" disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? requestsCopy.loadingMore : requestsCopy.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}
