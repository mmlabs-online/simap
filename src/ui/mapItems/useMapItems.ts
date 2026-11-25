"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MapItemDto } from "@/lib/map-items/types";
import type { MapItemsApi } from "./map-items-api";

export type MapItemsState = {
  status: "loading" | "ready" | "error";
  items: MapItemDto[];
  reload: () => void;
};

/** Loads the org's map item catalog when `enabled`. Stale responses (an older request, or after unmount) are dropped. */
export function useMapItems(api: MapItemsApi, enabled = true): MapItemsState {
  const [state, setState] = useState<{ status: MapItemsState["status"]; items: MapItemDto[] }>({
    status: "loading",
    items: [],
  });
  const counter = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(() => {
    const id = ++counter.current;
    setState((s) => ({ ...s, status: "loading" }));
    void api.list().then((result) => {
      if (!mounted.current || id !== counter.current) return;
      setState(
        result.ok ? { status: "ready", items: result.value } : { status: "error", items: [] },
      );
    });
  }, [api]);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  return { ...state, reload };
}
