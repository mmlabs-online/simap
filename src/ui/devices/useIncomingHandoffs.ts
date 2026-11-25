"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { HandoffBox, HandoffDto } from "@/lib/devices/types";
import type { DevicesApi } from "./devices-api";
import { INITIAL_INCOMING, fetcherFor, incomingReducer } from "./incoming-transfer";

/**
 * Loads one handoff list once. Stale answers are dropped. With `enabled` false nothing is fetched: the
 * state is `ready` with no items and `refresh` resolves to `[]` (a non-Admin never asks for `box=returns`, a non-Manager never for `box=extensions`).
 */
export function useHandoffList(api: DevicesApi, box: HandoffBox, enabled: boolean) {
  const [state, dispatch] = useReducer(incomingReducer, INITIAL_INCOMING);
  const fetchList = fetcherFor(api, box);
  const counter = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++counter.current;
    dispatch({ type: "load", id });
    const result = await fetchList();
    if (mounted.current) dispatch({ type: "loaded", id, result });
  }, [enabled, fetchList]);

  /** Refetches and resolves to the new items, or `null` when the request failed or a newer one replaced it. */
  const refresh = useCallback(async (): Promise<HandoffDto[] | null> => {
    if (!enabled) return [];
    const id = ++counter.current;
    dispatch({ type: "refresh", id });
    const result = await fetchList();
    if (mounted.current) dispatch({ type: "loaded", id, result });
    return result.ok && counter.current === id ? result.value.items : null;
  }, [enabled, fetchList]);

  useEffect(() => {
    void load();
  }, [load]);

  return enabled
    ? { ...state, refresh }
    : { ...INITIAL_INCOMING, status: "ready" as const, refresh };
}

/** Loads the caller's incoming transfers once. */
export function useIncomingHandoffs(api: DevicesApi) {
  return useHandoffList(api, "incoming", true);
}
