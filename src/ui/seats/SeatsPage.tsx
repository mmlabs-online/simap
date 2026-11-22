"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApiFetch } from "../auth/api-fetch-context";
import { Card } from "../Card";
import { seatsCopy } from "../copy/seats";
import { createRoomsApi } from "../rooms/rooms-api";
import { useSession } from "../session";
import { AddSeatsDialog } from "./AddSeatsDialog";
import { ConfirmSeatDialog } from "./ConfirmSeatDialog";
import {
  focusAfterDelete,
  canManageSeats,
  routeNotice,
  shouldReplaceAfterDelete,
} from "./seat-actions";
import { SeatActions } from "./SeatActions";
import { SeatDetailPanel } from "./SeatDetailPanel";
import { panelView, parseSeatParam, retryTarget, seatHref } from "./seat-view";
import { createSeatsApi } from "./seats-api";
import { SeatsView } from "./SeatsView";
import { useRoomSeats } from "./useRoomSeats";
import { useSeatActions } from "./useSeatActions";

function SeatsPageInner({ roomCode }: { roomCode: string }) {
  const apiFetch = useApiFetch();
  const tier = useSession()?.tier;
  const roomsApi = useMemo(() => createRoomsApi(apiFetch), [apiFetch]);
  const seatsApi = useMemo(() => createSeatsApi(apiFetch), [apiFetch]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlParam = parseSeatParam(searchParams.getAll("seat"));
  // A deleted seat counts as closed at once, so the reload cannot flash "Seat not found".
  const [dismissedCode, setDismissedCode] = useState<string | null>(null);
  const [focusAfter, setFocusAfter] = useState<{ code: string; codesBefore: string[] } | null>(
    null,
  );
  const param =
    urlParam.kind === "code" && urlParam.code === dismissedCode
      ? { kind: "none" as const }
      : urlParam;
  const openCode = param.kind === "code" ? param.code : null;
  const { resolution, list, detail, reloadRooms, reloadSeats, retryDetail, refresh } = useRoomSeats(
    roomsApi,
    seatsApi,
    roomCode,
    openCode,
  );
  const roomId = resolution.kind === "found" ? resolution.room.id : null;

  useEffect(() => {
    if (dismissedCode !== null && !(urlParam.kind === "code" && urlParam.code === dismissedCode)) {
      setDismissedCode(null);
    }
  }, [dismissedCode, urlParam]);

  // The latest URL, for a write that finishes after the user moved on.
  const latest = useRef({ code: null as string | null, pathname });
  const mounted = useRef(false);
  useEffect(() => {
    latest.current = { code: urlParam.kind === "code" ? urlParam.code : null, pathname };
  }, [urlParam, pathname]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onDeleted = useCallback(
    (code: string) => {
      setDismissedCode(code);
      setFocusAfter({ code, codesBefore: list.seats.map((s) => s.code) });
      if (shouldReplaceAfterDelete(mounted.current, latest.current.code, code)) {
        router.replace(seatHref(latest.current.pathname, null), { scroll: false });
      }
    },
    [list.seats, router],
  );
  const actions = useSeatActions({ seatsApi, roomId, openCode, refresh, onDeleted });

  // After a delete, wait for the reload, then focus the next row, the previous row, Add, or main.
  useEffect(() => {
    if (!focusAfter || list.status === "loading") return;
    const active = document.activeElement;
    const byCode = (c: string): HTMLElement | null =>
      document.querySelector(`[data-seat-code="${CSS.escape(c)}"]`);
    const target = focusAfterDelete(
      focusAfter.codesBefore,
      focusAfter.code,
      list.seats.map((s) => s.code),
    );
    const lost =
      !active ||
      active === document.body ||
      active.id === "main" ||
      active === byCode(focusAfter.code);
    if (lost) {
      (
        (target ? byCode(target) : null) ??
        document.querySelector<HTMLElement>("[data-add-seats]") ??
        document.getElementById("main")
      )?.focus();
    }
    setFocusAfter(null);
  }, [focusAfter, list]);

  const onRetry = () => void (resolution.kind === "error" ? reloadRooms() : reloadSeats());
  const onPanelRetry = () => {
    const target = retryTarget(resolution, list);
    if (target === "rooms") void reloadRooms();
    else if (target === "seats") void reloadSeats();
    else retryDetail();
  };

  const view = panelView(param, resolution, list, detail);
  const { notice, dialog } = actions;
  const { panel: panelNotice, page: pageNotice } = routeNotice(notice, openCode);
  const confirm =
    dialog && dialog.kind !== "add"
      ? dialog.kind === "delete"
        ? {
            title: seatsCopy.actions.deleteTitle(dialog.seat.code),
            body: seatsCopy.actions.deleteBody,
            submitLabel: seatsCopy.actions.deleteSubmit,
          }
        : {
            title: seatsCopy.actions.releaseTitle(dialog.seat.code),
            body: seatsCopy.actions.releaseBody,
            submitLabel: seatsCopy.actions.releaseSubmit,
          }
      : null;

  return (
    <>
      <SeatsView
        roomCode={roomCode}
        resolution={resolution}
        list={list}
        onRetry={onRetry}
        onOpen={(code) => router.push(seatHref(pathname, code), { scroll: false })}
        onAdd={canManageSeats(tier) ? actions.openAdd : undefined}
        notice={pageNotice}
      />
      <SeatDetailPanel
        view={view}
        seatCode={openCode}
        onClose={() => router.replace(seatHref(pathname, null), { scroll: false })}
        onRetry={onPanelRetry}
        focusSignal={actions.focusSignal}
        actions={
          <SeatActions
            tier={tier}
            seat={view.kind === "ready" ? view.seat : null}
            notice={panelNotice}
            busy={actions.busy}
            onDelete={actions.requestDelete}
            onRelease={actions.requestRelease}
          />
        }
      />
      <ConfirmSeatDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        body={confirm?.body ?? ""}
        submitLabel={confirm?.submitLabel ?? ""}
        submitting={actions.busy}
        onClose={actions.closeDialog}
        onConfirm={() => void actions.confirm()}
      />
      <AddSeatsDialog
        open={dialog?.kind === "add"}
        submitting={actions.busy}
        onClose={actions.closeDialog}
        onAdd={(count) => void actions.add(count)}
      />
    </>
  );
}

/** Room detail page. `useSearchParams` sits inside `<Suspense>`. Renders only below `AuthGate`. */
export function SeatsPage({ roomCode }: { roomCode: string }) {
  return (
    <Suspense
      fallback={
        <div className="p-4 lg:p-6">
          <Card className="h-48 animate-pulse">
            <div aria-busy="true" />
          </Card>
        </div>
      }
    >
      <SeatsPageInner roomCode={roomCode} />
    </Suspense>
  );
}
