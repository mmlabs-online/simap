"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeviceDto } from "@/lib/devices/types";
import { useApiFetch } from "../auth/api-fetch-context";
import { createRoomsApi } from "../rooms/rooms-api";
import { createSeatsApi } from "../seats/seats-api";
import { DeviceDetailDialogs } from "./DeviceDetailDialogs";
import { DeviceDetailView } from "./DeviceDetailView";
import { DeviceHistory } from "./DeviceHistory";
import { DeviceRowActions } from "./DeviceRowActions";
import {
  afterRefresh,
  detailCancelOutcome,
  detailHandlers,
  doneNotice,
  type DetailDialog,
  type DetailDone,
  type DeviceNotice,
} from "./device-detail-actions";
import { createDevicesApi } from "./devices-api";
import { useDeviceDetail } from "./useDeviceDetail";

/** Device detail page: the device, where it is, the holder, any pending handoff and its history. Renders only below `AuthGate`. */
export function DeviceDetailPage({ deviceId }: { deviceId: string }) {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createDevicesApi(apiFetch), [apiFetch]);
  const roomsApi = useMemo(() => createRoomsApi(apiFetch), [apiFetch]);
  const seatsApi = useMemo(() => createSeatsApi(apiFetch), [apiFetch]);
  const { detail, history, retryDetail, retryHistory, loadMore, refresh, refreshDevice } =
    useDeviceDetail(api, deviceId);
  const [dialog, setDialog] = useState<DetailDialog | null>(null);
  const [notice, setNotice] = useState<DeviceNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const acting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focused = useRef(false);

  // Once, when the page first reaches ready or notFound.
  useEffect(() => {
    if (focused.current || (detail.status !== "ready" && detail.status !== "notFound")) return;
    focused.current = true;
    headingRef.current?.focus();
  }, [detail.status]);

  // After the commit, so the heading is the one of the new branch (ready or notFound).
  useEffect(() => {
    if (focusRequest > 0) headingRef.current?.focus();
  }, [focusRequest]);

  /** Shows the notice, reloads device and history without a skeleton, then moves focus to the heading. */
  const finish = useCallback(
    async (next: DeviceNotice) => {
      acting.current = true;
      setBusy(true);
      setNotice(next);
      const ok = await refresh();
      setNotice(afterRefresh(next, ok));
      setBusy(false);
      acting.current = false;
      setFocusRequest((n) => n + 1);
    },
    [refresh],
  );

  const handlers = useMemo(
    () =>
      detailHandlers(
        (d) => {
          setNotice(null);
          setDialog(d);
        },
        async (device: DeviceDto) => {
          const pending = device.pendingHandoff;
          if (acting.current || !pending) return;
          acting.current = true;
          setBusy(true);
          setNotice(null);
          const outcome = detailCancelOutcome(
            await api.cancelHandoff(pending.id),
            device,
            pending.kind,
          );
          acting.current = false;
          if (outcome.refresh) return void finish(outcome.notice);
          setNotice(outcome.notice);
          setBusy(false);
          setFocusRequest((n) => n + 1);
        },
      ),
    [api, finish],
  );

  const onDone = (done: DetailDone) => {
    setDialog(null);
    void finish(doneNotice(done));
  };

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
            <DeviceRowActions
              device={detail.device}
              handlers={handlers}
              busyId={busy ? detail.device.id : null}
            />
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
      <DeviceDetailDialogs
        dialog={dialog}
        api={api}
        seatsApi={seatsApi}
        roomsApi={roomsApi}
        onClose={() => setDialog(null)}
        onStale={() => void refreshDevice()}
        onDone={onDone}
      />
    </>
  );
}
