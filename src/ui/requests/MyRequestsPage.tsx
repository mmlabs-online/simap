"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MyRequestDto } from "@/lib/requests/types";
import { useApiFetch } from "../auth/api-fetch-context";
import { mergeNewIds, newestDecidedAt } from "./request-badge";
import { MyRequestsView } from "./MyRequestsView";
import { createRequestsApi } from "./requests-api";
import { cancelOutcome, type CancelOutcome } from "./requests-state";
import { useMyRequests } from "./useMyRequests";
import { useSetRequestBadge } from "./useRequestBadge";

/** My requests: the list, Cancel on pending rows, and the mark-seen call that clears the nav badge. */
export function MyRequestsPage() {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createRequestsApi(apiFetch), [apiFetch]);
  const setBadge = useSetRequestBadge();
  const mounted = useRef(true);
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  const markedUpTo = useRef<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<CancelOutcome["notice"] | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
      const r = await api.markSeen(upTo);
      if (r.ok && mounted.current) setBadge(r.value.unseen);
    },
    [api, setBadge],
  );
  const list = useMyRequests(api, (items) => void onPage(items));

  const onCancel = async (item: MyRequestDto) => {
    if (cancellingId !== null) return;
    setCancellingId(item.id);
    setNotice(null);
    const outcome = cancelOutcome(await api.cancel(item.id));
    if (mounted.current) setNotice(outcome.notice);
    if (outcome.reload) await list.reload();
    if (mounted.current) setCancellingId(null);
  };

  return (
    <MyRequestsView
      state={list.status}
      items={list.items}
      newIds={newIds}
      hasMore={list.hasMore}
      loadingMore={list.loadingMore}
      errorCode={list.errorCode}
      cancellingId={cancellingId}
      notice={notice}
      onRetry={() => void list.reload()}
      onLoadMore={() => void list.loadMore()}
      onCancel={(item) => void onCancel(item)}
    />
  );
}
