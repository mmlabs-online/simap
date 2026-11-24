"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardDto } from "@/lib/dashboard/types";
import type { DashboardApi } from "./dashboard-api";

type State = {
  status: "loading" | "error" | "ready";
  data: DashboardDto | null;
  errorCode: string | null;
};

/** Loads the dashboard on mount. Stale responses (an older request, or after unmount) are dropped. */
export function useDashboard(api: DashboardApi) {
  const [state, setState] = useState<State>({ status: "loading", data: null, errorCode: null });
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
    const result = await api.get();
    if (!mounted.current || id !== counter.current) return;
    setState(
      result.ok
        ? { status: "ready", data: result.value, errorCode: null }
        : { status: "error", data: null, errorCode: result.code },
    );
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
