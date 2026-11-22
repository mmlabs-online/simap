"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  canLoadMore,
  INITIAL_PICKER,
  normalizePickerQuery,
  pickerReducer,
  type LoadPage,
} from "./member-picker";

/**
 * Loads the picker list: at once on mount and on a `reloadToken` change, 300 ms after the query
 * changes. Each request has an id; the reducer drops answers that are no longer current.
 */
export function useMemberPicker(loadPage: LoadPage, reloadToken: number) {
  const [state, dispatch] = useReducer(pickerReducer, INITIAL_PICKER);
  const [query, setQuery] = useState("");
  const counter = useRef(0);
  const mounted = useRef(true);
  const lastQuery = useRef<string | null>(null);
  const queryRef = useRef("");
  const normalized = normalizePickerQuery(query);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const search = useCallback(
    async (q: string) => {
      const id = ++counter.current;
      lastQuery.current = q;
      dispatch({ type: "search", id });
      const result = await loadPage(q, null);
      if (mounted.current) dispatch({ type: "loaded", id, result });
    },
    [loadPage],
  );

  useEffect(() => {
    queryRef.current = normalized;
  }, [normalized]);

  useEffect(() => {
    void search(queryRef.current);
  }, [search, reloadToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (normalized !== lastQuery.current) void search(normalized);
    }, 300);
    return () => clearTimeout(timer);
  }, [normalized, search]);

  const loadMore = useCallback(async () => {
    if (!canLoadMore(state)) return;
    const id = ++counter.current;
    dispatch({ type: "more", id });
    const result = await loadPage(lastQuery.current ?? "", state.nextCursor);
    if (mounted.current) dispatch({ type: "loaded", id, result });
  }, [loadPage, state]);

  return {
    state,
    query,
    setQuery,
    loadMore,
    retry: () => void search(lastQuery.current ?? normalized),
    select: (memberId: string) => dispatch({ type: "select", memberId }),
  };
}
