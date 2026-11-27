import type { ReactNode, Ref } from "react";
import type { RequestListItemDto, RequestStatus } from "@/lib/requests/types";
import { apiErrorMessage } from "../copy/api";
import { requestsCopy } from "../copy/requests";
import { shellCopy } from "../copy/shell";
import { Button } from "../Button";
import { Card } from "../Card";
import { FilterChips, Pill } from "../Chip";
import { requestStatusLook } from "../portal/my-requests";
import { formatRequestTime, occupantHintId, statusOptions } from "./requests-state";

export type ApprovalsViewProps = {
  /** `forbidden` = the visitor may not review requests: no filter, no list, no request was made. */
  state: "loading" | "error" | "ready" | "forbidden";
  filter: RequestStatus;
  items: RequestListItemDto[];
  hasMore: boolean;
  loadingMore: boolean;
  errorCode: string | null;
  onFilter: (status: RequestStatus) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  /** Slot for per-row controls (used by the decision dialogs slice). */
  actions?: (item: RequestListItemDto) => ReactNode;
  /** Result of the last decision; status tone -> role=status, error tone -> role=alert. */
  notice?: { tone: "status" | "error"; text: string } | null;
  /** Focus target after a decision. */
  headingRef?: Ref<HTMLHeadingElement>;
};

/** The Approvals page body. Pure: data and handlers come from props. */
export function ApprovalsView({
  state,
  filter,
  items,
  hasMore,
  loadingMore,
  errorCode,
  onFilter,
  onRetry,
  onLoadMore,
  actions,
  notice,
  headingRef,
}: ApprovalsViewProps) {
  const title = (
    <h1 ref={headingRef} tabIndex={-1} className="text-display text-text-primary outline-none">
      {shellCopy.pages.approvals.title}
    </h1>
  );
  if (state === "forbidden") {
    return (
      <div className="page-content flex flex-col gap-4">
        {title}
        <Card className="px-6 py-12 text-center">
          <p role="alert" className="text-label text-text-secondary">
            {requestsCopy.noAccess}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-content flex flex-col gap-4">
      {title}

      {notice &&
        (notice.tone === "error" ? (
          <p role="alert" className="text-label font-semibold text-danger">
            {notice.text}
          </p>
        ) : (
          <p role="status" className="text-label font-semibold text-text-primary">
            {notice.text}
          </p>
        ))}

      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto">
          <FilterChips
            options={statusOptions()}
            value={filter}
            onChange={onFilter}
            ariaLabel={requestsCopy.filterLabel}
          />
        </div>
        <p aria-live="polite" className="text-label font-normal text-text-secondary">
          {state === "ready" ? requestsCopy.summary(items.length, hasMore) : null}
        </p>
      </div>

      {state === "loading" && (
        <Card className="h-40 animate-pulse">
          <div aria-busy="true" className="h-full" />
        </Card>
      )}

      {state === "error" && (
        <Card className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-label font-semibold text-danger">
            {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {requestsCopy.retry}
          </Button>
        </Card>
      )}

      {state === "ready" && items.length === 0 && (
        <Card className="px-6 py-12 text-center">
          <p className="text-label text-text-secondary">{requestsCopy.emptyFor[filter]}</p>
        </Card>
      )}

      {state === "ready" && items.length > 0 && (
        <ul className="grid gap-3">
          {items.map((it) => (
            <li key={it.id}>
              <Card className="flex min-w-0 flex-col gap-1 break-words p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-label font-semibold text-text-primary">
                    {it.subject.displayName}
                  </span>
                  {it.status !== "pending" && (
                    <Pill
                      dot
                      tone={requestStatusLook(it.status).tone}
                      label={requestsCopy.statusLabel[it.status]}
                    />
                  )}
                </div>
                <p className="text-label font-normal text-text-primary">
                  {requestsCopy.seatLine(it.seat.code, it.seat.roomCode)}
                </p>
                {it.status === "pending" && (
                  <p
                    id={it.currentOccupant ? occupantHintId(it.id) : undefined}
                    className="text-label font-normal text-text-secondary"
                  >
                    {it.currentOccupant
                      ? requestsCopy.occupiedBy(it.currentOccupant.displayName)
                      : requestsCopy.seatEmpty}
                  </p>
                )}
                <p className="text-caption text-text-secondary">
                  <time dateTime={it.createdAt}>
                    {requestsCopy.requestedAt(formatRequestTime(it.createdAt))}
                  </time>
                </p>
                {it.status !== "pending" && it.decidedAt !== null && (
                  <p className="text-caption text-text-secondary">
                    <time dateTime={it.decidedAt}>
                      {requestsCopy.decidedLine(
                        it.status,
                        it.decidedBy?.displayName ?? null,
                        formatRequestTime(it.decidedAt),
                      )}
                    </time>
                  </p>
                )}
                {actions?.(it)}
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
