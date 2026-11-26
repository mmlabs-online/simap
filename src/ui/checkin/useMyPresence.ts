"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MyPresenceDto, MyPresenceResponse } from "@/lib/presence/types";
import type { PresenceApi } from "./presence-api";

type State = {
  status: "loading" | "ready" | "error";
  data: MyPresenceResponse | null;
  errorCode: string | null;
};
const INITIAL: State = { status: "loading", data: null, errorCode: null };

/** The caller's presence today and recent check-ins. Stale answers are dropped by a counter. */
export function useMyPresence(api: PresenceApi) {
  const [state, setState] = useState<State>(INITIAL);
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
    setState(INITIAL);
    const r = await api.mine();
    if (!mounted.current || id !== counter.current) return;
    setState(
      r.ok
        ? { status: "ready", data: r.value, errorCode: null }
        : { status: "error", data: null, errorCode: r.code },
    );
  }, [api]);

  /** Refetches without a skeleton; a failed refresh keeps the data. Polling (SIM-060) calls this. */
  const refresh = useCallback(async () => {
    const id = ++counter.current;
    const r = await api.mine();
    if (!mounted.current || id !== counter.current) return;
    if (r.ok) setState({ status: "ready", data: r.value, errorCode: null });
  }, [api]);

  /** Writes a PUT/DELETE/PATCH result into the data without a refetch. */
  const apply = useCallback((presence: MyPresenceDto | null) => {
    counter.current++;
    setState((prev) =>
      prev.data
        ? { ...prev, data: { ...prev.data, presence } }
        : { status: "ready", data: { workDate: "", presence, recent: [] }, errorCode: null },
    );
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload, refresh, apply };
}
