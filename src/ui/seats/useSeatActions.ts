"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SeatDto } from "@/lib/seats/types";
import { actionOutcome, deleteBlock, type ActionResult, type SeatAction } from "./seat-actions";
import type { SeatsApi } from "./seats-api";

export type SeatDialog =
  | { kind: "add" }
  | { kind: "delete"; seat: SeatDto }
  | { kind: "release"; seat: SeatDto };
export type SeatNotice = { seatCode: string | null; text: string };

/**
 * One flow for the seat writes: dialog, busy and notice state. A write always finishes and reports
 * through the notice, even if its dialog was closed meanwhile. `onDeleted` runs synchronously before
 * the reload so the page can close the panel without a "Seat not found" flash.
 */
export function useSeatActions({
  seatsApi,
  roomId,
  openCode,
  refresh,
  onDeleted,
}: {
  seatsApi: SeatsApi;
  roomId: string | null;
  openCode: string | null;
  refresh: () => Promise<void>;
  onDeleted: (seatCode: string) => void;
}) {
  const [dialog, setDialog] = useState<SeatDialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<SeatNotice | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const busyRef = useRef(false);

  // Another seat opened: a notice about the old seat is stale.
  useEffect(() => {
    setNotice((n) =>
      n && n.seatCode !== null && openCode !== null && n.seatCode !== openCode ? null : n,
    );
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
      const outcome = actionOutcome(action, await call());
      // Close only the dialog that started this write, not a newer one.
      setDialog((d) => (d === started ? null : d));
      setNotice(outcome.message ? { seatCode, text: outcome.message } : null);
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

  return {
    dialog: shown,
    busy,
    notice,
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
    requestRelease: (seat: SeatDto) => setDialog({ kind: "release", seat }),
    closeDialog: () => setDialog(null),
    add: (count: number) =>
      roomId === null
        ? Promise.resolve()
        : run("add", null, shown, () => seatsApi.add(roomId, count)),
    confirm: () => {
      if (!shown || shown.kind === "add") return Promise.resolve();
      const { seat } = shown;
      return shown.kind === "delete"
        ? run("delete", seat.code, shown, () => seatsApi.remove(seat.id))
        : run("release", seat.code, shown, () => seatsApi.release(seat.id));
    },
  };
}
