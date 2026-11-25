"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { HandoffDto } from "@/lib/devices/types";
import type { DevicesApi } from "./devices-api";
import { INITIAL_INCOMING, incomingReducer } from "./incoming-transfer";

/** Loads the caller's incoming transfers once. Stale answers are dropped. */
export function useIncomingHandoffs(api: DevicesApi) {
  const [state, dispatch] = useReducer(incomingReducer, INITIAL_INCOMING);
  const counter = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const id = ++counter.current;
    dispatch({ type: "load", id });
    const result = await api.incomingHandoffs();
    if (mounted.current) dispatch({ type: "loaded", id, result });
  }, [api]);

  /** Refetches and resolves to the new items, or `null` when the request failed or a newer one replaced it. */
  const refresh = useCallback(async (): Promise<HandoffDto[] | null> => {
    const id = ++counter.current;
    dispatch({ type: "refresh", id });
    const result = await api.incomingHandoffs();
    if (mounted.current) dispatch({ type: "loaded", id, result });
    return result.ok && counter.current === id ? result.value.items : null;
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh };
}
