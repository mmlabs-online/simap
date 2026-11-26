"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApiFetch } from "../auth/api-fetch-context";
import { portalCopy } from "../copy/portal";
import { bannerHandlers } from "../devices/device-actions";
import { createDevicesApi } from "../devices/devices-api";
import {
  badgeCountAfter,
  confirmOutcome,
  declineOutcome,
  focusAfter,
  type FocusTarget,
  type IncomingCall,
  type IncomingOutcome,
  type IncomingResult,
} from "../devices/incoming-transfer";
import { IncomingTransfers } from "../devices/IncomingTransfers";
import { OverdueBanner } from "../devices/OverdueBanner";
import { useDeviceDetailActions } from "../devices/useDeviceDetailActions";
import { useSetHandoffBadge } from "../devices/useHandoffBadge";
import { useHandoffList } from "../devices/useIncomingHandoffs";
import { createRoomsApi } from "../rooms/rooms-api";
import { createSeatsApi } from "../seats/seats-api";
import { useSession } from "../session";
import { MyDevicesView } from "./MyDevicesView";
import { portalHandlers } from "./portal-state";
import { useMyDevices } from "./useMyDevices";

/** The My devices tab: the caller's held devices, owner actions, incoming transfers and the overdue banner. */
export function MyDevicesTab() {
  const apiFetch = useApiFetch();
  const session = useSession();
  const api = useMemo(() => createDevicesApi(apiFetch), [apiFetch]);
  const roomsApi = useMemo(() => createRoomsApi(apiFetch), [apiFetch]);
  const seatsApi = useMemo(() => createSeatsApi(apiFetch), [apiFetch]);
  const myDevices = useMyDevices(api);
  const incoming = useHandoffList(api, "incoming", true);
  const setBadge = useSetHandoffBadge();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const incomingHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestFocus = useCallback(() => headingRef.current?.focus(), []);
  const { handlers, busyId, notice, dialogs } = useDeviceDetailActions({
    api,
    roomsApi,
    seatsApi,
    tier: session?.tier ?? "user",
    refresh: myDevices.refresh,
    requestFocus,
  });
  const rowHandlers = useMemo(() => portalHandlers(handlers), [handlers]);

  const acting = useRef(false);
  const [incomingBusyId, setIncomingBusyId] = useState<string | null>(null);
  // The notice of the latest action: a host notice (row actions) or an incoming outcome (Confirm/Decline).
  const [shown, setShown] = useState<IncomingOutcome["notice"] | null>(null);
  useEffect(() => setShown(notice), [notice]);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);

  // Applied after the commit, so the node it points at is the new one, not the one the await replaced.
  useEffect(() => {
    if (focusTarget === null) return;
    if (focusTarget.kind === "confirm") {
      document
        .querySelector<HTMLElement>(`[data-handoff-confirm="${CSS.escape(focusTarget.id)}"]`)
        ?.focus();
    } else if (focusTarget.kind === "section") {
      incomingHeadingRef.current?.focus();
    } else {
      headingRef.current?.focus();
    }
    setFocusTarget(null);
  }, [focusTarget]);

  /** Confirm or decline: one at a time; refreshes the lists and the nav badge, then moves focus. */
  async function act(
    item: (typeof incoming.items)[number],
    call: IncomingCall,
    outcomeOf: (r: IncomingResult) => IncomingOutcome,
  ) {
    if (acting.current) return;
    acting.current = true;
    setIncomingBusyId(item.id);
    setShown(null);
    const before = incoming.items;
    const outcome = outcomeOf(await call());
    setShown(outcome.notice);
    if (outcome.refresh) {
      const [inc, , count] = await Promise.all([
        incoming.refresh(),
        myDevices.refresh(),
        api.handoffCount(),
      ]);
      const next = badgeCountAfter(count, inc, [], []);
      if (next !== null) setBadge(next);
      setFocusTarget(
        focusAfter(before, item.id, inc ?? before.filter((h) => h.id !== item.id), "incoming"),
      );
    }
    acting.current = false;
    setIncomingBusyId(null);
  }

  return (
    <>
      <MyDevicesView
        status={myDevices.status}
        devices={myDevices.items}
        hasMore={myDevices.nextCursor !== null}
        loadingMore={myDevices.loadingMore}
        errorCode={myDevices.errorCode}
        actions={rowHandlers}
        busyId={busyId}
        notice={shown}
        headingRef={headingRef}
        onRetry={() => void myDevices.reload()}
        onLoadMore={() => void myDevices.loadMore()}
        banner={
          <OverdueBanner
            devices={myDevices.items}
            truncated={myDevices.nextCursor !== null}
            handlers={bannerHandlers(rowHandlers)}
            busyId={busyId}
            onShowAll={requestFocus}
          />
        }
        incoming={
          (incoming.items.length > 0 || incoming.errorCode !== null) && (
            <section aria-label={portalCopy.devices.waiting} className="flex flex-col gap-3">
              <IncomingTransfers
                items={incoming.items}
                truncated={incoming.truncated}
                errorCode={incoming.errorCode}
                busyId={incomingBusyId}
                headingRef={incomingHeadingRef}
                onConfirm={(item) =>
                  void act(
                    item,
                    () => api.confirmHandoff(item.id),
                    (r) => confirmOutcome(r, item, "all"),
                  )
                }
                onDecline={(item) =>
                  void act(
                    item,
                    () => api.declineHandoff(item.id),
                    (r) => declineOutcome(r, item),
                  )
                }
                onRetry={() =>
                  void incoming.refresh().then((items) => {
                    if (items?.length === 0) setFocusTarget({ kind: "page" });
                  })
                }
              />
            </section>
          )
        }
      />
      {dialogs}
    </>
  );
}
