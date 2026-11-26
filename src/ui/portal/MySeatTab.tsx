"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SeatDto } from "@/lib/seats/types";
import type { MyRequestDto } from "@/lib/requests/types";
import { useApiFetch } from "../auth/api-fetch-context";
import { portalCopy } from "../copy/portal";
import { mergeNewIds, newestDecidedAt } from "../requests/request-badge";
import { createRequestsApi } from "../requests/requests-api";
import { cancelOutcome } from "../requests/requests-state";
import { useMyRequests } from "../requests/useMyRequests";
import { useSetRequestBadge } from "../requests/useRequestBadge";
import { ConfirmSeatDialog } from "../seats/ConfirmSeatDialog";
import { createSeatsApi } from "../seats/seats-api";
import { MyRequestsPanel } from "./MyRequestsPanel";
import { MySeatView } from "./MySeatView";
import { releaseOutcome, releaseView, seatTabEmpty } from "./my-seats";
import { useMySeats } from "./useMySeats";

type Notice = { tone: "status" | "error"; text: string };

/** The My seat tab: my seats (View on map, Release) and my requests (Cancel). With `markSeen` it marks the decisions shown as seen (POR-02). */
export function MySeatTab({ markSeen }: { markSeen: boolean }) {
  const apiFetch = useApiFetch();
  const seatsApi = useMemo(() => createSeatsApi(apiFetch), [apiFetch]);
  const requestsApi = useMemo(() => createRequestsApi(apiFetch), [apiFetch]);
  const seats = useMySeats(apiFetch, seatsApi);
  const setBadge = useSetRequestBadge();
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  const markedUpTo = useRef<string | null>(null);
  const mounted = useRef(true);
  /**
   * Marks seen only up to the newest decision that was shown. It never sends an empty body, because the
   * server reads that as "now" and would clear decisions the user has not been shown.
   */
  const onPage = useCallback(
    async (items: MyRequestDto[]) => {
      setNewIds((prev) => mergeNewIds(prev, items));
      const upTo = newestDecidedAt(items, markedUpTo.current);
      if (upTo === null) return;
      markedUpTo.current = upTo;
      const r = await requestsApi.markSeen(upTo);
      if (r.ok && mounted.current) setBadge(r.value.unseen);
    },
    [requestsApi, setBadge],
  );
  const requests = useMyRequests(requestsApi, markSeen ? (items) => void onPage(items) : undefined);
  const acting = useRef(false);
  const [releasing, setReleasing] = useState<SeatDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function confirmRelease() {
    if (releasing === null || acting.current) return;
    acting.current = true;
    setSubmitting(true);
    setNotice(null);
    const outcome = releaseOutcome(await seatsApi.release(releasing.id));
    if (mounted.current) {
      setReleasing(null);
      setNotice(
        outcome.message === null
          ? { tone: "status", text: portalCopy.seat.released }
          : { tone: "error", text: outcome.message },
      );
    }
    if (outcome.reload) await Promise.all([seats.refresh(), requests.reload()]);
    acting.current = false;
    if (mounted.current) setSubmitting(false);
  }

  async function cancel(item: MyRequestDto) {
    if (acting.current) return;
    acting.current = true;
    setCancellingId(item.id);
    setNotice(null);
    const outcome = cancelOutcome(await requestsApi.cancel(item.id));
    if (mounted.current) setNotice(outcome.notice);
    if (outcome.reload) await requests.reload();
    acting.current = false;
    if (mounted.current) setCancellingId(null);
  }

  const view = releasing ? releaseView(releasing) : null;
  const empty =
    seats.status === "ready" && seatTabEmpty(seats.seats, requests.status, requests.items.length);
  return (
    <>
      <MySeatView
        status={seats.status}
        seats={seats.seats}
        errorCode={seats.errorCode}
        empty={empty}
        busy={submitting || cancellingId !== null}
        notice={notice}
        onRetry={() => void seats.reload()}
        onRelease={setReleasing}
        requests={
          <MyRequestsPanel
            hideEmpty={empty}
            state={requests.status}
            items={requests.items}
            newIds={newIds}
            hasMore={requests.hasMore}
            loadingMore={requests.loadingMore}
            errorCode={requests.errorCode}
            cancellingId={cancellingId}
            onRetry={() => void requests.reload()}
            onLoadMore={() => void requests.loadMore()}
            onCancel={(item) => void cancel(item)}
          />
        }
      />
      <ConfirmSeatDialog
        open={releasing !== null}
        title={view?.title ?? ""}
        body={view?.body ?? ""}
        submitLabel={view?.submitLabel ?? ""}
        submitting={submitting}
        onClose={() => setReleasing(null)}
        onConfirm={() => void confirmRelease()}
      />
    </>
  );
}
