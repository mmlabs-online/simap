"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SeatDto } from "@/lib/seats/types";
import { apiErrorMessage } from "../copy/api";
import {
  actionOutcome,
  decideReask,
  deleteBlock,
  pickStep,
  reaskDialog,
  removeDialog,
  refusedDialog,
  requestResult,
  type ActionResult,
  type AssignDialog,
  type CannotSeatDialog,
  type ClearCannotSeatDialog,
  type OccupantConfirm,
  type RemoveDialog,
  type SeatAction,
  type TagsDialog,
} from "./seat-actions";
import type { PickerMember } from "./member-picker";
import type { RequestsApi } from "../requests/requests-api";
import type { SeatsApi } from "./seats-api";

export type SeatDialog =
  | { kind: "add" }
  | { kind: "delete"; seat: SeatDto }
  | { kind: "release"; seat: SeatDto }
  | RemoveDialog
  | CannotSeatDialog
  | ClearCannotSeatDialog
  | TagsDialog
  | AssignDialog;
export type SeatNotice = { seatCode: string | null; text: string };
export type SeatInfo = { seatCode: string; text: string };

/**
 * One flow for the seat writes: dialog, busy and notice state. A write always finishes and reports
 * through the notice, even if its dialog was closed meanwhile. `onDeleted` runs synchronously before
 * the reload so the page can close the panel without a "Seat not found" flash.
 */
export function useSeatActions({
  seatsApi,
  requestsApi,
  roomId,
  openCode,
  refresh,
  onDeleted,
}: {
  seatsApi: SeatsApi;
  requestsApi: Pick<RequestsApi, "create">;
  roomId: string | null;
  openCode: string | null;
  refresh: () => Promise<void>;
  onDeleted: (seatCode: string) => void;
}) {
  const [dialog, setDialog] = useState<SeatDialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<SeatNotice | null>(null);
  const [info, setInfo] = useState<SeatInfo | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const busyRef = useRef(false);

  // A seat opened: any notice bound to a seat is stale (this runs only when openCode changes).
  useEffect(() => {
    setNotice((n) => (n && n.seatCode !== null && openCode !== null ? null : n));
    setInfo(null);
  }, [openCode]);

  const run = useCallback(
    async (
      action: SeatAction,
      seatCode: string | null,
      started: SeatDialog | null,
      call: () => Promise<ActionResult>,
    ) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setNotice(null);
      setInfo(null);
      const outcome = actionOutcome(action, await call());
      // Close only the dialog that started this write, not a newer one.
      setDialog((d) => (d === started ? null : d));
      setNotice(outcome.message ? { seatCode, text: outcome.message } : null);
      setInfo(outcome.info && seatCode !== null ? { seatCode, text: outcome.info } : null);
      if (outcome.closePanel && seatCode !== null) onDeleted(seatCode);
      if (outcome.reload) await refresh();
      busyRef.current = false;
      setBusy(false);
      if (outcome.reload && !outcome.closePanel) setFocusSignal((n) => n + 1);
    },
    [onDeleted, refresh],
  );

  // A confirm belongs to the seat that was open; Back closes it with the panel and drops it for good.
  useEffect(() => {
    setDialog((d) => (d && d.kind !== "add" && d.seat.code !== openCode ? null : d));
  }, [openCode]);
  const shown = dialog && dialog.kind !== "add" && dialog.seat.code !== openCode ? null : dialog;
  const shownRef = useRef<SeatDialog | null>(null);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  /**
   * PUT the occupant. Busy is held through the PUT, any refetch and the reload, so a new confirm
   * cannot be submitted before the page shows the current state. A refusal never leads to a PUT:
   * `occupant_changed` only refetches and asks again; a write happens only from a user's submit.
   */
  const writeOccupant = async (
    started: AssignDialog,
    choice: OccupantConfirm | { memberId: string; memberName: string; expectedOccupantId: null },
  ) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    const code = started.seat.code;
    const result = await seatsApi.setOccupant(
      started.seat.id,
      choice.memberId,
      choice.expectedOccupantId,
    );
    const still = () => shownRef.current === started;
    const finish = (next: SeatDialog | null, message: string | null) => {
      setDialog((d) => (d === started ? next : d));
      // The dialog was closed meanwhile: the message still shows, as a notice.
      const asNotice = next === null || !still();
      setNotice(message && asNotice ? { seatCode: code, text: message } : null);
    };
    let closed = true;
    let closePanel = false;
    let reload = true;
    if (result.ok) {
      finish(null, null);
    } else if (result.code === "occupant_changed") {
      const fresh = await seatsApi.get(started.seat.id);
      const step = decideReask(fresh, { id: choice.memberId, name: choice.memberName });
      if (step.kind === "ask") {
        finish(reaskDialog(started, step.seat, step.confirm), apiErrorMessage(result.code));
        closed = !still();
      } else if (step.kind === "done") {
        finish(null, null);
      } else if (step.kind === "cannotSeat") {
        finish(null, apiErrorMessage("seat_cannot_seat"));
      } else {
        const failed = actionOutcome("assign", { ok: false, code: step.code });
        reload = failed.reload;
        closePanel = failed.closePanel;
        if (failed.reload && !failed.closePanel) {
          finish(refusedDialog(started, failed.message ?? ""), failed.message);
          closed = !still();
        } else {
          finish(null, failed.message);
        }
      }
    } else {
      const outcome = actionOutcome("assign", result);
      closePanel = outcome.closePanel;
      reload = outcome.reload;
      if (outcome.keepDialog) {
        finish(refusedDialog(started, outcome.message ?? ""), outcome.message);
        closed = !still();
      } else {
        finish(null, outcome.message);
      }
    }
    if (closePanel) onDeleted(code);
    if (reload) await refresh();
    busyRef.current = false;
    setBusy(false);
    // With the dialog still open the panel heading is inert, so focus moves only when it closed.
    if (reload && closed && !closePanel) setFocusSignal((n) => n + 1);
  };

  return {
    dialog: shown,
    busy,
    notice,
    info,
    focusSignal,
    openAdd: () => {
      setNotice(null);
      setDialog({ kind: "add" });
    },
    requestDelete: (seat: SeatDto) => {
      const block = deleteBlock(seat);
      if (block) setNotice({ seatCode: seat.code, text: block });
      else setDialog({ kind: "delete", seat });
    },
    /** Sends no dialog (`started` is null), so an open dialog is left alone. */
    requestSeat: (seat: SeatDto) =>
      run("request", seat.code, null, async () => requestResult(await requestsApi.create(seat.id))),
    requestRelease: (seat: SeatDto) => setDialog({ kind: "release", seat }),
    requestRemove: (seat: SeatDto) => {
      const next = removeDialog(seat);
      if (next) setDialog(next);
    },
    requestSetCannotSeat: (seat: SeatDto) => setDialog({ kind: "cannotSeat", seat }),
    requestClearCannotSeat: (seat: SeatDto) => setDialog({ kind: "clearCannotSeat", seat }),
    requestTags: (seat: SeatDto) => {
      setNotice(null);
      setDialog({ kind: "tags", seat });
    },
    setTags: (patch: { groupId?: string | null; projectId?: string | null }) => {
      const started = shown;
      if (started?.kind !== "tags") return Promise.resolve();
      return run("setTags", started.seat.code, started, () =>
        seatsApi.setTags(started.seat.id, patch),
      );
    },
    setCannotSeat: (reason: string) => {
      const started = shown;
      if (started?.kind !== "cannotSeat") return Promise.resolve();
      return run("setCannotSeat", started.seat.code, started, () =>
        seatsApi.setCannotSeat(started.seat.id, reason),
      );
    },
    requestAssign: (seat: SeatDto) => {
      setNotice(null);
      setDialog({
        kind: "assign",
        seat,
        confirm: null,
        revision: 0,
        error: null,
        reloadToken: 0,
      });
    },
    /** A member was picked: send at once on an empty seat, ask on an occupied one, nothing for the same person. */
    pick: (member: PickerMember) => {
      if (shown?.kind !== "assign") return Promise.resolve();
      const step = pickStep(shown.seat, member);
      if (step.kind === "send") return writeOccupant(shown, step);
      if (step.kind === "confirm") {
        setDialog({ ...shown, confirm: step.confirm, error: null });
      } else {
        setDialog(null);
      }
      return Promise.resolve();
    },
    /** Closes only the replace confirm, and not while its write is in flight. */
    closeConfirm: () => {
      if (busyRef.current) return;
      setDialog((d) => (d?.kind === "assign" ? { ...d, confirm: null } : d));
    },
    closeDialog: () => setDialog(null),
    add: (count: number) =>
      roomId === null
        ? Promise.resolve()
        : run("add", null, shown, () => seatsApi.add(roomId, count)),
    confirm: () => {
      if (!shown || shown.kind === "add") return Promise.resolve();
      if (shown.kind === "assign") {
        return shown.confirm ? writeOccupant(shown, shown.confirm) : Promise.resolve();
      }
      if (shown.kind === "cannotSeat" || shown.kind === "tags") return Promise.resolve();
      if (shown.kind === "remove") {
        const started = shown;
        return run("removeOccupant", started.seat.code, started, () =>
          seatsApi.setOccupant(started.seat.id, null, started.expectedOccupantId),
        );
      }
      const { seat } = shown;
      if (shown.kind === "clearCannotSeat") {
        return run("clearCannotSeat", seat.code, shown, () => seatsApi.clearCannotSeat(seat.id));
      }
      return shown.kind === "delete"
        ? run("delete", seat.code, shown, () => seatsApi.remove(seat.id))
        : run("release", seat.code, shown, () => seatsApi.release(seat.id));
    },
  };
}
