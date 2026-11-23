"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { roomEditorHref } from "@/lib/nav";
import { useApiFetch } from "../auth/api-fetch-context";
import { Card } from "../Card";
import { seatsCopy } from "../copy/seats";
import { createRoomsApi } from "../rooms/rooms-api";
import { RoomMapSection } from "../roomlayout";
import { useSession } from "../session";
import { AddSeatsDialog } from "./AddSeatsDialog";
import { CannotSeatDialog } from "./CannotSeatDialog";
import { ConfirmSeatDialog } from "./ConfirmSeatDialog";
import { MemberPickerDialog } from "./MemberPickerDialog";
import {
  confirmText,
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
import { useRoomLayout } from "./useRoomLayout";
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
  const map = useRoomLayout(seatsApi, roomId);
  const reloadMap = map.reload;
  const refreshAll = useCallback(
    () => Promise.all([refresh(), reloadMap()]).then(() => undefined),
    [refresh, reloadMap],
  );
  const openSeat = (code: string) => router.push(seatHref(pathname, code), { scroll: false });

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
  const actions = useSeatActions({ seatsApi, roomId, openCode, refresh: refreshAll, onDeleted });

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
  const assign = dialog?.kind === "assign" ? dialog : null;
  const copy = seatsCopy.actions;
  let confirm: { title: string; body: string; submitLabel: string } | null = null;
  if (assign?.confirm) {
    const replace = assign.confirm.occupantName !== null;
    confirm = {
      title: replace
        ? copy.replaceTitle(assign.seat.code)
        : copy.assignConfirmTitle(assign.seat.code),
      body: confirmText(assign.confirm),
      submitLabel: replace ? copy.replace : copy.assign,
    };
  } else if (dialog?.kind === "delete") {
    confirm = {
      title: copy.deleteTitle(dialog.seat.code),
      body: copy.deleteBody,
      submitLabel: copy.deleteSubmit,
    };
  } else if (dialog?.kind === "remove") {
    confirm = {
      title: copy.removeTitle(dialog.seat.code),
      body: copy.removeBody(dialog.occupantName),
      submitLabel: copy.removeSubmit,
    };
  } else if (dialog?.kind === "clearCannotSeat") {
    confirm = {
      title: copy.unblockTitle(dialog.seat.code),
      body: copy.unblockBody,
      submitLabel: copy.unblockSubmit,
    };
  } else if (dialog?.kind === "release") {
    confirm = {
      title: copy.releaseTitle(dialog.seat.code),
      body: copy.releaseBody,
      submitLabel: copy.releaseSubmit,
    };
  }

  return (
    <>
      <SeatsView
        roomCode={roomCode}
        resolution={resolution}
        list={list}
        onRetry={onRetry}
        onOpen={openSeat}
        map={
          <RoomMapSection
            state={map.state}
            onRetry={() => void map.reload()}
            onSelect={openSeat}
            editHref={canManageSeats(tier) ? roomEditorHref(roomCode) : undefined}
          />
        }
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
            onAssign={actions.requestAssign}
            onDelete={actions.requestDelete}
            onRelease={actions.requestRelease}
            onRemove={actions.requestRemove}
            onSetCannotSeat={actions.requestSetCannotSeat}
            onClearCannotSeat={actions.requestClearCannotSeat}
          />
        }
      />
      {assign && (
        <MemberPickerDialog
          open
          seat={assign.seat}
          loadPage={seatsApi.activeMembers}
          reloadToken={assign.reloadToken}
          error={assign.error}
          submitting={actions.busy && assign.confirm === null}
          onClose={actions.closeDialog}
          onPick={(m) => void actions.pick(m)}
        />
      )}
      <ConfirmSeatDialog
        key={assign ? `assign-${assign.revision}` : "plain"}
        open={confirm !== null}
        title={confirm?.title ?? ""}
        body={confirm?.body ?? ""}
        submitLabel={confirm?.submitLabel ?? ""}
        submitting={actions.busy}
        onClose={assign ? actions.closeConfirm : actions.closeDialog}
        onConfirm={() => void actions.confirm()}
      />
      <CannotSeatDialog
        seat={dialog?.kind === "cannotSeat" ? dialog.seat : null}
        submitting={actions.busy}
        onClose={actions.closeDialog}
        onSubmit={(reason) => void actions.setCannotSeat(reason)}
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
