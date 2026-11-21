"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditEntryDto, AuditFacets } from "@/lib/audit/types";
import type { AuditApi, AuditQuery } from "./audit-api";

type State = {
  status: "loading" | "error" | "ready";
  items: AuditEntryDto[];
  nextCursor: string | null;
  loadingMore: boolean;
  errorCode: string | null;
};

const LOADING: State = {
  status: "loading",
  items: [],
  nextCursor: null,
  loadingMore: false,
  errorCode: null,
};
const NO_FACETS: AuditFacets = { actors: [], entities: [] };

/**
 * Loads the audit list for `query` (null = invalid filters, nothing to load) and the filter facets once.
 * A filter change restarts the list; stale responses (older request, or after unmount) are dropped.
 */
export function useAudit(api: AuditApi, query: AuditQuery | null) {
  const [state, setState] = useState<State>(LOADING);
  const [facets, setFacets] = useState<AuditFacets>(NO_FACETS);
  const counter = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    void api.facets().then((r) => {
      if (live && r.ok) setFacets(r.value);
    });
    return () => {
      live = false;
    };
  }, [api]);

  const reload = useCallback(async () => {
    const id = ++counter.current;
    if (query === null) {
      setState({ ...LOADING, status: "ready" });
      return;
    }
    setState(LOADING);
    const result = await api.list(query);
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
  }, [api, query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (query === null || state.nextCursor === null || state.loadingMore) return;
    const id = counter.current;
    setState((s) => ({ ...s, loadingMore: true }));
    const result = await api.list(query, state.nextCursor);
    if (!mounted.current || id !== counter.current) return;
    setState((s) =>
      result.ok
        ? {
            ...s,
            items: [...s.items, ...result.value.items],
            nextCursor: result.value.nextCursor,
            loadingMore: false,
          }
        : { ...s, loadingMore: false, status: "error", errorCode: result.code },
    );
  }, [api, query, state.nextCursor, state.loadingMore]);

  return {
    status: state.status,
    items: state.items,
    hasMore: state.nextCursor !== null,
    loadingMore: state.loadingMore,
    errorCode: state.errorCode,
    facets,
    reload,
    loadMore,
  };
}
