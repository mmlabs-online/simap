"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { SearchApi } from "./search-api";
import {
  canLoadMore,
  INITIAL_SEARCH,
  isSearchable,
  normalizeSearchQuery,
  searchReducer,
  type GroupKey,
} from "./search-state";

/**
 * Runs the search: at once for the URL's query (on mount and on a change that did not come from
 * here), 300 ms after the input changes. Each request has an id; the reducer drops stale answers.
 * `onCommit` writes the settled query to the URL.
 */
export function useSearch(api: SearchApi, urlQ: string, onCommit: (q: string) => void) {
  const [state, dispatch] = useReducer(searchReducer, INITIAL_SEARCH);
  const [query, setQuery] = useState(urlQ);
  const counter = useRef(0);
  const mounted = useRef(true);
  const committed = useRef<string | null>(null);
  const written = useRef(new Set<string>());
  const normalized = normalizeSearchQuery(query);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (q: string) => {
      committed.current = q;
      const id = ++counter.current;
      const searchable = isSearchable(q);
      dispatch({ type: "search", id, q: searchable ? q : "" });
      if (!searchable) return;
      const result = await api.searchAll(q);
      if (mounted.current) dispatch({ type: "loaded", id, result });
    },
    [api],
  );

  useEffect(() => {
    if (committed.current === null) {
      void run(urlQ);
    } else if (urlQ !== committed.current && !written.current.has(urlQ)) {
      written.current.clear();
      setQuery(urlQ);
      void run(urlQ);
    }
  }, [urlQ, run]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (normalized === committed.current) return;
      written.current.add(normalized);
      onCommit(normalized);
      void run(normalized);
    }, 300);
    return () => clearTimeout(timer);
  }, [normalized, run, onCommit]);

  const loadMore = useCallback(
    async (group: GroupKey) => {
      const cursor = state[group].nextCursor;
      if (!canLoadMore(state, group) || cursor === null) return;
      const id = ++counter.current;
      dispatch({ type: "more", group, id });
      const result = await api.searchMore(group, state.query, cursor);
      if (mounted.current) dispatch({ type: "moreLoaded", group, id, result });
    },
    [api, state],
  );

  return {
    state,
    query,
    setQuery,
    loadMore,
    retry: () => void run(committed.current ?? ""),
  };
}
