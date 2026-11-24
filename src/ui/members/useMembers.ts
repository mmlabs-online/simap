"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MemberDto, MemberGroupRef } from "@/lib/members/types";
import type { MembersApi } from "./members-api";
import { appendUnique, type MemberQuery } from "./members-state";

type State = {
  status: "loading" | "error" | "ready";
  items: MemberDto[];
  groups: MemberGroupRef[];
  nextCursor: string | null;
  loadingMore: boolean;
  errorCode: string | null;
};

const LOADING: State = {
  status: "loading",
  items: [],
  groups: [],
  nextCursor: null,
  loadingMore: false,
  errorCode: null,
};

/**
 * Loads the member list for `query` (memoise it). A query change restarts the list; stale responses
 * (older request, or after unmount) are dropped.
 */
export function useMembers(api: MembersApi, query: MemberQuery) {
  const [state, setState] = useState<State>(LOADING);
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
    const result = await api.list(query);
    if (!mounted.current || id !== counter.current) return;
    setState(
      result.ok
        ? {
            ...LOADING,
            status: "ready",
            items: result.value.items,
            groups: result.value.groups,
            nextCursor: result.value.nextCursor,
          }
        : { ...LOADING, status: "error", errorCode: result.code },
    );
  }, [api, query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (state.nextCursor === null || state.loadingMore) return;
    const id = counter.current;
    setState((s) => ({ ...s, loadingMore: true }));
    const result = await api.list(query, state.nextCursor);
    if (!mounted.current || id !== counter.current) return;
    setState((s) =>
      result.ok
        ? {
            ...s,
            items: appendUnique(s.items, result.value.items),
            nextCursor: result.value.nextCursor,
            loadingMore: false,
          }
        : { ...s, loadingMore: false, status: "error", errorCode: result.code },
    );
  }, [api, query, state.nextCursor, state.loadingMore]);

  return {
    status: state.status,
    items: state.items,
    groups: state.groups,
    hasMore: state.nextCursor !== null,
    loadingMore: state.loadingMore,
    errorCode: state.errorCode,
    reload,
    loadMore,
  };
}
