"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GroupsResult } from "./groups-api";

type State<T> = { status: "loading" | "error" | "ready"; items: T[]; errorCode: string | null };

/** Loads one list. Stale responses (an older request, or after unmount) are dropped. `load` must be stable. */
export function useList<T>(load: () => Promise<GroupsResult<T[]>>) {
  const [state, setState] = useState<State<T>>({ status: "loading", items: [], errorCode: null });
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
    const result = await load();
    if (!mounted.current || id !== counter.current) return;
    setState(
      result.ok
        ? { status: "ready", items: result.value, errorCode: null }
        : { status: "error", items: [], errorCode: result.code },
    );
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
