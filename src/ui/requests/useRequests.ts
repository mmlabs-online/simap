"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RequestStatus } from "@/lib/requests/types";
import type { RequestsApi } from "./requests-api";
import { appendPage, type ListState } from "./requests-state";

const LOADING: ListState = {
  status: "loading",
  items: [],
  nextCursor: null,
  loadingMore: false,
  errorCode: null,
};

/**
 * Loads the requests with `status`. A status change restarts the list and drops any in-flight Load more;
 * stale responses (older request, or after unmount) are dropped.
 */
export function useRequests(api: RequestsApi, status: RequestStatus) {
  const [state, setState] = useState<ListState>(LOADING);
  const counter = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const id = ++counter.current;
    setState(LOADING);
    const result = await api.list(status);
    if (!mounted.current || id !== counter.current) return;
    setState(
      result.ok
        ? {
            ...LOADING,
            status: "ready",
            items: result.value.items,
            nextCursor: result.value.nextCursor,
          }
        : { ...LOADING, status: "error", errorCode: result.code },
    );
  }, [api, status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (state.nextCursor === null || state.loadingMore) return;
    const id = counter.current;
    setState((s) => ({ ...s, loadingMore: true }));
    const result = await api.list(status, state.nextCursor);
    if (!mounted.current || id !== counter.current) return;
    setState((s) =>
      result.ok
        ? appendPage(s, result.value)
        : { ...s, loadingMore: false, status: "error", errorCode: result.code },
    );
  }, [api, status, state.nextCursor, state.loadingMore]);

  return {
    status: state.status,
    items: state.items,
    hasMore: state.nextCursor !== null,
    loadingMore: state.loadingMore,
    errorCode: state.errorCode,
    reload,
    loadMore,
  };
}
