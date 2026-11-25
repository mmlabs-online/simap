"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DeviceDto, HandoffBox, HandoffDto, PlacementFilter } from "@/lib/devices/types";
import { atLeastTier } from "@/lib/tier";
import { useApiFetch } from "../auth/api-fetch-context";
import { createRoomsApi } from "../rooms/rooms-api";
import { createSeatsApi } from "../seats/seats-api";
import { useSession } from "../session";
import type { AssignMode } from "./assign-device";
import { AssignDeviceDialog } from "./AssignDeviceDialog";
import { DeleteDeviceDialog } from "./DeleteDeviceDialog";
import { DeviceFormDialog } from "./DeviceFormDialog";
import { PlaceDeviceDialog } from "./PlaceDeviceDialog";
import { devicesCopy } from "../copy/devices";
import { DevicesView, type DevicesViewProps } from "./DevicesView";
import { TransferDeviceDialog } from "./TransferDeviceDialog";
import { cancelOutcome } from "./transfer-device";
import { confirmReturnOutcome, takeBackDone } from "./return-device";
import { PendingReturns } from "./PendingReturns";
import { PendingExtensions } from "./PendingExtensions";
import { approveExtensionOutcome, rejectExtensionOutcome } from "./extension-device";
import { ReturnDeviceDialog } from "./ReturnDeviceDialog";
import { ExtendDeviceDialog } from "./ExtendDeviceDialog";
import { OverdueBanner } from "./OverdueBanner";
import { TakeBackDeviceDialog } from "./TakeBackDeviceDialog";
import { bannerHandlers, type DeviceRowHandlers } from "./device-actions";
import { filterAfterCreate } from "./device-form";
import { createDevicesApi } from "./devices-api";
import type { PlaceMode } from "./place-device";
import { IncomingTransfers } from "./IncomingTransfers";
import {
  badgeCountAfter,
  confirmOutcome,
  declineOutcome,
  focusAfter,
  handoffBoxes,
  type FocusTarget,
  type IncomingCall,
  type IncomingOutcome,
  type IncomingResult,
} from "./incoming-transfer";
import { useDevices } from "./useDevices";
import { useSetHandoffBadge } from "./useHandoffBadge";
import { useHandoffList } from "./useIncomingHandoffs";

/** Devices page: loads the list for the chosen filter. Renders only below `AuthGate`. */
export function DevicesPage() {
  const apiFetch = useApiFetch();
  const api = useMemo(() => createDevicesApi(apiFetch), [apiFetch]);
  const roomsApi = useMemo(() => createRoomsApi(apiFetch), [apiFetch]);
  const seatsApi = useMemo(() => createSeatsApi(apiFetch), [apiFetch]);
  const [filter, setFilter] = useState<PlacementFilter>("all");
  const [placing, setPlacing] = useState<{ device: DeviceDto; mode: PlaceMode } | null>(null);
  const [holding, setHolding] = useState<{ device: DeviceDto; mode: AssignMode } | null>(null);
  const session = useSession();
  const isAdmin = session ? atLeastTier(session.tier, "admin") : false;
  const isManager = session ? atLeastTier(session.tier, "manager") : false;
  const [form, setForm] = useState<{ device: DeviceDto | null } | null>(null);
  const [deleting, setDeleting] = useState<DeviceDto | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { status, items, truncated, errorCode, reload, refresh } = useDevices(api, filter);
  // A separate list, so the banner does not depend on the page filter.
  const overdue = useDevices(api, "overdue");
  const [transferring, setTransferring] = useState<DeviceDto | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const acting = useRef(false);
  const [notice, setNotice] = useState<DevicesViewProps["notice"]>(null);
  const incoming = useHandoffList(api, "incoming", true);
  const boxes = handoffBoxes(isAdmin, isManager);
  const returns = useHandoffList(api, "returns", boxes.includes("returns"));
  const extensions = useHandoffList(api, "extensions", boxes.includes("extensions"));
  const [returning, setReturning] = useState<DeviceDto | null>(null);
  const [takingBack, setTakingBack] = useState<DeviceDto | null>(null);
  const [extending, setExtending] = useState<DeviceDto | null>(null);
  const setBadge = useSetHandoffBadge();
  const [incomingBusyId, setIncomingBusyId] = useState<string | null>(null);
  const incomingHeadingRef = useRef<HTMLHeadingElement>(null);
  const returnsHeadingRef = useRef<HTMLHeadingElement>(null);
  const extensionsHeadingRef = useRef<HTMLHeadingElement>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);

  // Applied after the commit, so the node it points at is the new one, not the one the await replaced.
  useEffect(() => {
    if (focusTarget === null) return;
    if (focusTarget.kind === "confirm") {
      document
        .querySelector<HTMLElement>(`[data-handoff-confirm="${CSS.escape(focusTarget.id)}"]`)
        ?.focus();
    } else if (focusTarget.kind === "section") {
      (focusTarget.list === "returns"
        ? returnsHeadingRef
        : focusTarget.list === "extensions"
          ? extensionsHeadingRef
          : incomingHeadingRef
      ).current?.focus();
    } else {
      headingRef.current?.focus();
    }
    setFocusTarget(null);
  }, [focusTarget]);

  /** Refreshes the device list, the three handoff lists and the nav badge. Resolves to the three lists (null when one failed). */
  async function refreshAll() {
    const [inc, ret, ext] = await Promise.all([
      incoming.refresh(),
      returns.refresh(),
      extensions.refresh(),
      refresh(),
      overdue.refresh(),
    ]);
    const count = badgeCountAfter(await api.handoffCount(), inc, ret, ext);
    if (count !== null) setBadge(count);
    return { inc, ret, ext };
  }

  /** Refreshes the device list and the overdue list (an expiry edit can clear overdue). */
  const refreshDevices = () => Promise.all([refresh(), overdue.refresh()]);

  /** Confirm, decline or cancel from a list: one action at a time; refreshes everything, then moves focus. */
  async function act(
    list: HandoffBox,
    item: HandoffDto,
    call: IncomingCall,
    outcomeOf: (r: IncomingResult) => IncomingOutcome,
  ) {
    if (acting.current) return;
    acting.current = true;
    setIncomingBusyId(item.id);
    setNotice(null);
    const before =
      list === "returns"
        ? returns.items
        : list === "extensions"
          ? extensions.items
          : incoming.items;
    const outcome = outcomeOf(await call());
    setNotice(outcome.notice);
    if (outcome.refresh) {
      const { inc, ret, ext } = await refreshAll();
      const after = list === "returns" ? ret : list === "extensions" ? ext : inc;
      setFocusTarget(
        focusAfter(before, item.id, after ?? before.filter((h) => h.id !== item.id), list),
      );
    }
    acting.current = false;
    setIncomingBusyId(null);
  }
  const actions = useMemo<DeviceRowHandlers>(
    () => ({
      onAssign: (device, mode) => {
        setNotice(null);
        setHolding({ device, mode });
      },
      onEditHolding: (device, mode) => {
        setNotice(null);
        setHolding({ device, mode });
      },
      onPlace: (device, mode) => {
        setNotice(null);
        setPlacing({ device, mode });
      },
      onEdit: (device) => {
        setNotice(null);
        setForm({ device });
      },
      onDelete: (device) => {
        setNotice(null);
        setDeleting(device);
      },
      onTransfer: (device) => {
        setNotice(null);
        setTransferring(device);
      },
      onReturn: (device) => {
        setNotice(null);
        setReturning(device);
      },
      onExtend: (device) => {
        setNotice(null);
        setExtending(device);
      },
      onTakeBack: (device) => {
        setNotice(null);
        setTakingBack(device);
      },
      onCancelHandoff: async (device) => {
        const pending = device.pendingHandoff;
        if (acting.current || !pending) return;
        acting.current = true;
        setCancellingId(device.id);
        setNotice(null);
        const outcome = cancelOutcome(await api.cancelHandoff(pending.id), device, pending.kind);
        setNotice(outcome.notice);
        if (outcome.refresh) await refreshAll();
        acting.current = false;
        setCancellingId(null);
        headingRef.current?.focus();
      },
    }),
    [
      api,
      refresh,
      overdue.refresh,
      incoming.refresh,
      returns.refresh,
      extensions.refresh,
      setBadge,
    ],
  );

  return (
    <>
      <DevicesView
        status={status}
        devices={items}
        truncated={truncated}
        errorCode={errorCode}
        filter={filter}
        onFilter={setFilter}
        onRetry={() => void reload()}
        actions={actions}
        onNew={isAdmin ? () => setForm({ device: null }) : undefined}
        headingRef={headingRef}
        busyId={cancellingId}
        notice={notice}
        incoming={
          <>
            <OverdueBanner
              devices={overdue.items}
              truncated={overdue.truncated}
              handlers={bannerHandlers(actions)}
              busyId={cancellingId}
              onShowAll={() => setFilter("overdue")}
            />
            <IncomingTransfers
              items={incoming.items}
              truncated={incoming.truncated}
              errorCode={incoming.errorCode}
              busyId={incomingBusyId}
              headingRef={incomingHeadingRef}
              onConfirm={(item) =>
                void act(
                  "incoming",
                  item,
                  () => api.confirmHandoff(item.id),
                  (r) => confirmOutcome(r, item, filter),
                )
              }
              onDecline={(item) =>
                void act(
                  "incoming",
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
            <PendingReturns
              items={returns.items}
              truncated={returns.truncated}
              errorCode={returns.errorCode}
              busyId={incomingBusyId}
              headingRef={returnsHeadingRef}
              onConfirm={(item) =>
                void act(
                  "returns",
                  item,
                  () => api.confirmHandoff(item.id),
                  (r) => confirmReturnOutcome(r, item, filter),
                )
              }
              onCancel={(item) =>
                void act(
                  "returns",
                  item,
                  () => api.cancelHandoff(item.id),
                  (r) => cancelOutcome(r, item.device, "return"),
                )
              }
              onRetry={() =>
                void returns.refresh().then((items) => {
                  if (items?.length === 0) setFocusTarget({ kind: "page" });
                })
              }
            />
            <PendingExtensions
              items={extensions.items}
              truncated={extensions.truncated}
              errorCode={extensions.errorCode}
              busyId={incomingBusyId}
              headingRef={extensionsHeadingRef}
              onApprove={(item) =>
                void act(
                  "extensions",
                  item,
                  () => api.confirmHandoff(item.id),
                  (r) => approveExtensionOutcome(r, item),
                )
              }
              onReject={(item) =>
                void act(
                  "extensions",
                  item,
                  () => api.declineHandoff(item.id),
                  (r) => rejectExtensionOutcome(r, item),
                )
              }
              onRetry={() =>
                void extensions.refresh().then((items) => {
                  if (items?.length === 0) setFocusTarget({ kind: "page" });
                })
              }
            />
          </>
        }
      />
      <TransferDeviceDialog
        device={transferring}
        devicesApi={api}
        seatsApi={seatsApi}
        onClose={() => setTransferring(null)}
        onStale={() => void refreshDevices()}
        onDone={(device) => {
          setTransferring(null);
          setNotice({
            tone: "status",
            text: devicesCopy.transfer.sent(device.name, device.inventoryNumber),
          });
          void refreshDevices().then(() => headingRef.current?.focus());
        }}
      />
      <ReturnDeviceDialog
        device={returning}
        devicesApi={api}
        onClose={() => setReturning(null)}
        onStale={() => void refreshAll()}
        onDone={(device) => {
          setReturning(null);
          setNotice({
            tone: "status",
            text: devicesCopy.giveBack.sent(device.name, device.inventoryNumber),
          });
          void refreshAll().then(() => headingRef.current?.focus());
        }}
      />
      <ExtendDeviceDialog
        device={extending}
        devicesApi={api}
        onClose={() => setExtending(null)}
        onStale={() => void refreshAll()}
        onDone={(device) => {
          setExtending(null);
          setNotice({
            tone: "status",
            text: devicesCopy.extend.sent(device.name, device.inventoryNumber),
          });
          void refreshAll().then(() => headingRef.current?.focus());
        }}
      />
      <TakeBackDeviceDialog
        device={takingBack}
        api={api}
        onClose={() => setTakingBack(null)}
        onStale={() => void refreshAll()}
        onDone={(device) => {
          setTakingBack(null);
          setNotice({ tone: "status", text: takeBackDone(device, filter) });
          void refreshAll().then(() => headingRef.current?.focus());
        }}
      />
      <PlaceDeviceDialog
        open={placing !== null}
        device={placing?.device ?? null}
        mode={placing?.mode ?? "place"}
        devicesApi={api}
        roomsApi={roomsApi}
        seatsApi={seatsApi}
        onClose={() => setPlacing(null)}
        onStale={() => void refreshDevices()}
        onDone={() => {
          setPlacing(null);
          void refreshDevices();
        }}
      />
      <AssignDeviceDialog
        open={holding !== null}
        device={holding?.device ?? null}
        mode={holding?.mode ?? "assign"}
        devicesApi={api}
        seatsApi={seatsApi}
        onClose={() => setHolding(null)}
        onStale={() => void refreshDevices()}
        onDone={(mode) => {
          setHolding(null);
          const done = refreshDevices();
          // An assigned row leaves the filter or swaps its button; an edited row keeps its button.
          if (mode === "assign") void done.then(() => headingRef.current?.focus());
        }}
      />
      <DeviceFormDialog
        open={form !== null}
        device={form?.device ?? null}
        api={api}
        onClose={() => setForm(null)}
        onDone={() => {
          const created = form?.device === null;
          const next = created ? filterAfterCreate(filter) : filter;
          setForm(null);
          if (next !== filter) setFilter(next);
          else void refreshDevices();
        }}
      />
      <DeleteDeviceDialog
        device={deleting}
        api={api}
        onClose={() => setDeleting(null)}
        onStale={() => void refreshDevices()}
        onDone={() => {
          setDeleting(null);
          void refreshDevices().then(() => headingRef.current?.focus());
        }}
      />
    </>
  );
}
