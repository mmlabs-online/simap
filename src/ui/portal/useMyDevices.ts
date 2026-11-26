"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DeviceDto } from "@/lib/devices/types";
import type { DevicesApi } from "../devices/devices-api";
import type { RefreshResult } from "../devices/useDeviceDetail";
import { appendPage, type ListState } from "../requests/requests-state";

const INITIAL: ListState<DeviceDto> = {
  status: "loading",
  items: [],
  nextCursor: null,
  loadingMore: false,
  errorCode: null,
};

/** Loads the caller's held devices (cursor paging). Stale answers are dropped by a counter. */
export function useMyDevices(api: DevicesApi) {
  const [state, setState] = useState<ListState<DeviceDto>>(INITIAL);
  const counter = useRef(0);
  const mounted = useRef(true);
  const cursor = useRef<string | null>(null);
  cursor.current = state.nextCursor;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const id = ++counter.current;
    setState(INITIAL);
    const r = await api.listMine();
    if (!mounted.current || id !== counter.current) return;
    setState(
      r.ok
        ? { ...INITIAL, status: "ready", items: r.value.items, nextCursor: r.value.nextCursor }
        : { ...INITIAL, status: "error", errorCode: r.code },
    );
  }, [api]);

  /** Refetches the first page without a skeleton; a failed refresh keeps the rows. */
  const refresh = useCallback(async (): Promise<RefreshResult> => {
    const id = ++counter.current;
    const r = await api.listMine();
    if (!mounted.current || id !== counter.current) return { ok: true };
    if (r.ok) {
      setState({
        ...INITIAL,
        status: "ready",
        items: r.value.items,
        nextCursor: r.value.nextCursor,
      });
      return { ok: true };
    }
    // The host reports the failure; the rows and the ready status stay.
    return { ok: false, code: r.code };
  }, [api]);

  const loadMore = useCallback(async () => {
    const at = cursor.current;
    if (at === null) return;
    const id = ++counter.current;
    setState((s) => ({ ...s, loadingMore: true, errorCode: null }));
    const r = await api.listMine(at);
    if (!mounted.current || id !== counter.current) return;
    setState((s) =>
      r.ok ? appendPage(s, r.value) : { ...s, loadingMore: false, errorCode: r.code },
    );
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload, refresh, loadMore };
}
