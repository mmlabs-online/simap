"use client";

import { useEffect, useMemo, useRef } from "react";
import { useApiFetch } from "../auth/api-fetch-context";
import { DeviceDetailView } from "./DeviceDetailView";
import { DeviceHistory } from "./DeviceHistory";
import { createDevicesApi } from "./devices-api";
import { useDeviceDetail } from "./useDeviceDetail";

/** Device detail page: the device, where it is, the holder, any pending handoff and its history. Renders only below `AuthGate`. */
export function DeviceDetailPage({ deviceId }: { deviceId: string }) {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createDevicesApi(apiFetch), [apiFetch]);
  const { detail, history, retryDetail, retryHistory, loadMore } = useDeviceDetail(api, deviceId);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focused = useRef(false);

  // Once, when the page first reaches ready or notFound.
  useEffect(() => {
    if (focused.current || (detail.status !== "ready" && detail.status !== "notFound")) return;
    focused.current = true;
    headingRef.current?.focus();
  }, [detail.status]);

  return (
    <DeviceDetailView
      status={detail.status}
      device={detail.device}
      errorCode={detail.errorCode}
      holderSince={history.holderSince}
      onRetry={() => void retryDetail()}
      headingRef={headingRef}
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
  );
}
