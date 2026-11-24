"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MyRequestDto } from "@/lib/requests/types";
import type { RequestsApi } from "./requests-api";
import { appendPage, type ListState } from "./requests-state";

const LOADING: ListState<MyRequestDto> = {
  status: "loading",
  items: [],
  nextCursor: null,
  loadingMore: false,
  errorCode: null,
};

/**
 * Loads the caller's own requests, newest first. Stale responses (an older load, or after unmount) are dropped.
 * `onPage` gets the items of every page that loaded, for the seen flow.
 */
export function useMyRequests(api: RequestsApi, onPage?: (items: MyRequestDto[]) => void) {
  const [state, setState] = useState<ListState<MyRequestDto>>(LOADING);
  const counter = useRef(0);
  const mounted = useRef(true);
  const onPageRef = useRef(onPage);

  useEffect(() => {
    onPageRef.current = onPage;
  }, [onPage]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const id = ++counter.current;
    setState(LOADING);
    const result = await api.mine();
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
    if (result.ok) onPageRef.current?.(result.value.items);
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (state.nextCursor === null || state.loadingMore) return;
    const id = counter.current;
    setState((s) => ({ ...s, loadingMore: true }));
    const result = await api.mine(state.nextCursor);
    if (!mounted.current || id !== counter.current) return;
    setState((s) =>
      result.ok
        ? appendPage(s, result.value)
        : { ...s, loadingMore: false, status: "error", errorCode: result.code },
    );
    if (result.ok) onPageRef.current?.(result.value.items);
  }, [api, state.nextCursor, state.loadingMore]);

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
