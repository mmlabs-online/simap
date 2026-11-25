"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApiFetch } from "../auth/api-fetch-context";
import { createRoomsApi } from "../rooms/rooms-api";
import { createSeatsApi } from "../seats/seats-api";
import { DeviceDetailView } from "./DeviceDetailView";
import { DeviceHistory } from "./DeviceHistory";
import { DeviceRowActions } from "./DeviceRowActions";
import { createDevicesApi } from "./devices-api";
import { useDeviceDetail } from "./useDeviceDetail";
import { useDeviceDetailActions } from "./useDeviceDetailActions";

/** Device detail page: the device, where it is, the holder, any pending handoff and its history. Renders only below `AuthGate`. */
export function DeviceDetailPage({ deviceId }: { deviceId: string }) {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createDevicesApi(apiFetch), [apiFetch]);
  const roomsApi = useMemo(() => createRoomsApi(apiFetch), [apiFetch]);
  const seatsApi = useMemo(() => createSeatsApi(apiFetch), [apiFetch]);
  const { detail, history, retryDetail, retryHistory, loadMore, refresh } = useDeviceDetail(
    api,
    deviceId,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focused = useRef(false);
  const [focusSeq, setFocusSeq] = useState(0);
  const requestFocus = useCallback(() => setFocusSeq((n) => n + 1), []);
  const { handlers, busyId, notice, dialogs } = useDeviceDetailActions({
    api,
    roomsApi,
    seatsApi,
    refresh,
    requestFocus,
  });

  // Once, when the page first reaches ready or notFound.
  useEffect(() => {
    if (focused.current || (detail.status !== "ready" && detail.status !== "notFound")) return;
    focused.current = true;
    headingRef.current?.focus();
  }, [detail.status]);

  // After an action, applied after the commit so a ready -> notFound switch focuses the new heading.
  useEffect(() => {
    if (focusSeq > 0) headingRef.current?.focus();
  }, [focusSeq]);

  return (
    <>
      <DeviceDetailView
        status={detail.status}
        device={detail.device}
        errorCode={detail.errorCode}
        holderSince={history.holderSince}
        onRetry={() => void retryDetail()}
        headingRef={headingRef}
        notice={notice}
        actions={
          detail.device && (
            <DeviceRowActions device={detail.device} handlers={handlers} busyId={busyId} />
          )
        }
        history={
          <DeviceHistory
            status={history.status}
            items={history.items}
            hasMore={history.nextCursor !== null}
            loadingMore={history.loadingMore}
            moreError={history.moreError}
            errorCode={history.errorCode}
            onRetry={() => void retryHistory()}
            onLoadMore={() => void loadMore()}
          />
        }
      />
      {dialogs}
    </>
  );
}
