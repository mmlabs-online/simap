"use client";

import { useState } from "react";
import type { MyRequestDto } from "@/lib/requests/types";
import { Button } from "../Button";
import { Pill } from "../Chip";
import { apiErrorMessage } from "../copy/api";
import { portalCopy } from "../copy/portal";
import { requestsCopy } from "../copy/requests";
import { SectionCard } from "../SectionCard";
import { SegmentedFilter } from "../SegmentedFilter";
import { MyRequestRow } from "./MyRequestRow";
import { REQUEST_FILTERS, countLabel, filterRequests, type MyRequestFilter } from "./my-requests";

export type MyRequestsPanelViewProps = {
  state: "loading" | "error" | "ready";
  items: MyRequestDto[];
  /** Ids to mark "New" for this visit. The view never reads `item.isNew`, so the mark survives a reload. */
  newIds: ReadonlySet<string>;
  hasMore: boolean;
  loadingMore: boolean;
  errorCode: string | null;
  cancellingId: string | null;
  filter: MyRequestFilter;
  onFilter: (filter: MyRequestFilter) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onCancel: (item: MyRequestDto) => void;
  /** Render nothing while ready and empty (the parent shows the one empty state). */
  hideEmpty?: boolean;
};

/** The My requests card: count, status filter and rows. Pure: data and handlers come from props. */
export function MyRequestsPanelView({
  state,
  items,
  newIds,
  hasMore,
  loadingMore,
  errorCode,
  cancellingId,
  filter,
  onFilter,
  onRetry,
  onLoadMore,
  onCancel,
  hideEmpty = false,
}: MyRequestsPanelViewProps) {
  if (hideEmpty && state === "ready" && items.length === 0) return null;
  const t = portalCopy.seat;
  const shown = filterRequests(items, filter);
  return (
    <SectionCard
      headingId="my-requests-heading"
      title={t.requestsHeading}
      subtitle={t.requestsSubtitle}
      titleAdornment={<Pill tone="neutral" label={countLabel(items.length, hasMore)} />}
      aside={
        <SegmentedFilter
          ariaLabel={t.filterLabel}
          value={filter}
          onChange={onFilter}
          options={REQUEST_FILTERS.map((value) => ({
            value,
            label: value === "all" ? t.filterAll : requestsCopy.statusLabel[value],
          }))}
        />
      }
      footer={
        state === "ready" && hasMore ? (
          <Button variant="tonal" disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? requestsCopy.loadingMore : requestsCopy.loadMore}
          </Button>
        ) : undefined
      }
    >
      {state === "loading" && (
        <div aria-busy="true" className="h-32 animate-pulse rounded-xl bg-canvas" />
      )}

      {state === "error" && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-label font-semibold text-danger">
            {apiErrorMessage(errorCode ?? "internal")}
          </p>
          <Button variant="tonal" size="sm" onClick={onRetry}>
            {requestsCopy.retry}
          </Button>
        </div>
      )}

      {state === "ready" && items.length === 0 && (
        <p className="py-6 text-center text-label text-text-secondary">{requestsCopy.mine.empty}</p>
      )}

      {state === "ready" && items.length > 0 && (
        <>
          {shown.length > 0 ? (
            <div className="-m-4 sm:-m-5">
              <ul aria-label={requestsCopy.mine.listLabel} className="divide-y divide-divider">
                {shown.map((it) => (
                  <MyRequestRow
                    key={it.id}
                    item={it}
                    isNew={newIds.has(it.id)}
                    cancellingId={cancellingId}
                    onCancel={onCancel}
                  />
                ))}
              </ul>
            </div>
          ) : (
            <p className="py-6 text-center text-label text-text-secondary">
              {filter === "all" ? requestsCopy.mine.empty : requestsCopy.emptyFor[filter]}
            </p>
          )}
          <p aria-live="polite" className="sr-only">
            {t.filterResult(shown.length, items.length)}
          </p>
        </>
      )}
    </SectionCard>
  );
}

/** The stateful panel: holds the status filter (client-side, over the loaded rows). */
export function MyRequestsPanel(props: Omit<MyRequestsPanelViewProps, "filter" | "onFilter">) {
  const [filter, setFilter] = useState<MyRequestFilter>("all");
  return <MyRequestsPanelView {...props} filter={filter} onFilter={setFilter} />;
}
