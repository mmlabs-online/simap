"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { DevicesApi } from "./devices-api";
import {
  INITIAL_DETAIL,
  INITIAL_HISTORY,
  detailReducer,
  historyReducer,
} from "./device-detail-state";
import { refreshOk } from "./device-detail-actions";

/** Loads one device and its first history page in parallel; stale answers are dropped. */
export function useDeviceDetail(api: DevicesApi, deviceId: string) {
  const [detail, dispatchDetail] = useReducer(detailReducer, INITIAL_DETAIL);
  const [history, dispatchHistory] = useReducer(historyReducer, INITIAL_HISTORY);
  const detailCounter = useRef(0);
  const historyCounter = useRef(0);
  const mounted = useRef(true);
  const cursor = useRef<string | null>(null);
  cursor.current = history.nextCursor;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const retryDetail = useCallback(async () => {
    const id = ++detailCounter.current;
    dispatchDetail({ type: "load", id });
    const result = await api.get(deviceId);
    if (mounted.current) dispatchDetail({ type: "loaded", id, result });
  }, [api, deviceId]);

  const retryHistory = useCallback(async () => {
    const id = ++historyCounter.current;
    dispatchHistory({ type: "load", id });
    const result = await api.history(deviceId);
    if (mounted.current) dispatchHistory({ type: "loaded", id, result });
  }, [api, deviceId]);

  const loadMore = useCallback(async () => {
    const next = cursor.current;
    if (next === null) return;
    const id = ++historyCounter.current;
    dispatchHistory({ type: "loadMore", id });
    const result = await api.history(deviceId, next);
    if (mounted.current) dispatchHistory({ type: "moreLoaded", id, result });
  }, [api, deviceId]);

  /** Silent reload of the device and page 1 of the history; resolves false when the page could not be updated. */
  const refresh = useCallback(async () => {
    const dId = ++detailCounter.current;
    const hId = ++historyCounter.current;
    dispatchDetail({ type: "refresh", id: dId });
    dispatchHistory({ type: "refresh", id: hId });
    const [d, h] = await Promise.all([api.get(deviceId), api.history(deviceId)]);
    if (mounted.current) {
      dispatchDetail({ type: "refreshed", id: dId, result: d });
      dispatchHistory({ type: "refreshed", id: hId, result: h });
    }
    return refreshOk(d, h);
  }, [api, deviceId]);

  /** Silent reload of the device only (a refused action does not change the history). */
  const refreshDevice = useCallback(async () => {
    const id = ++detailCounter.current;
    dispatchDetail({ type: "refresh", id });
    const result = await api.get(deviceId);
    if (mounted.current) dispatchDetail({ type: "refreshed", id, result });
  }, [api, deviceId]);

  useEffect(() => {
    void retryDetail();
    void retryHistory();
  }, [retryDetail, retryHistory]);

  return { detail, history, retryDetail, retryHistory, loadMore, refresh, refreshDevice };
}
