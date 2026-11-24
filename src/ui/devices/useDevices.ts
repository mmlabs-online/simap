"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { PlacementFilter } from "@/lib/devices/types";
import type { DevicesApi } from "./devices-api";
import { INITIAL_DEVICES, devicesReducer } from "./devices-state";

/** Loads the device list for a filter, again whenever the filter changes. Stale answers are dropped. */
export function useDevices(api: DevicesApi, filter: PlacementFilter) {
  const [state, dispatch] = useReducer(devicesReducer, INITIAL_DEVICES);
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
    dispatch({ type: "load", id });
    const result = await api.list(filter);
    if (mounted.current) dispatch({ type: "loaded", id, result });
  }, [api, filter]);

  /** Refetches without clearing the rows, so the list does not flash a skeleton after a change. */
  const refresh = useCallback(async () => {
    const id = ++counter.current;
    dispatch({ type: "refresh", id });
    const result = await api.list(filter);
    if (mounted.current) dispatch({ type: "loaded", id, result });
  }, [api, filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload, refresh };
}
