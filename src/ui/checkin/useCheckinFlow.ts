"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import {
  autoOpen,
  buttonAction,
  checkInOutcome,
  initialSelection,
  popupReducer,
  popupRooms,
} from "@/lib/checkin-popup";
import type { RoomDto } from "@/lib/rooms/types";
import type { SeatDto } from "@/lib/seats/types";
import { roomThumb, type RoomThumb } from "@/lib/sprites/room-thumb";
import type { SeatsApi } from "../seats/seats-api";
import type { CheckinButtonProps } from "./CheckinButton";
import type { CheckinPopupProps } from "./CheckinPopup";
import type { PresenceApi } from "./presence-api";
import type { useMyPresence } from "./useMyPresence";
import { usePopupExtras } from "./usePopupExtras";

type Seats = {
  status: "loading" | "ready" | "error";
  seats: SeatDto[];
  refresh: () => Promise<void>;
};

/**
 * The check-in popup and floating button behaviour (PRE-01/02/03): popup phase (once per page load), check-in and
 * check-out calls, error and busy state. Returns the props of `CheckinPopup` and `CheckinButton`.
 */
export function useCheckinFlow(input: {
  mySeats: Seats;
  rooms: readonly RoomDto[];
  myPresence: ReturnType<typeof useMyPresence>;
  presenceApi: PresenceApi;
  seatsApi: SeatsApi;
  shownCode: string | null;
  seatPanelOpen: boolean;
  navigate: (code: string) => void;
}): { popup: CheckinPopupProps; button: CheckinButtonProps } {
  const { mySeats, myPresence, presenceApi, seatsApi, shownCode } = input;
  const active = myPresence.data?.presence ?? null;
  const seatCount = mySeats.seats.length;
  const loaded = mySeats.status === "ready" && myPresence.status === "ready";
  const wantsAuto = autoOpen({
    seats: mySeats.status,
    seatCount,
    presence: myPresence.status,
    active,
    seatPanelOpen: input.seatPanelOpen,
  });
  // Settled without a reason to open (checked in already, or no seat): never open later, e.g. after a check-out.
  const wantsSkip = loaded && (active !== null || seatCount === 0);

  const [phase, dispatch] = useReducer(popupReducer, "pending");
  const [openCount, setOpenCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wantsAuto) dispatch("auto");
    else if (wantsSkip) dispatch("skip");
  }, [wantsAuto, wantsSkip]);
  useEffect(() => {
    if (phase === "open") setOpenCount((c) => c + 1);
  }, [phase]);

  const roomIds = useMemo(() => [...new Set(mySeats.seats.map((s) => s.roomId))], [mySeats.seats]);
  const extras = usePopupExtras(presenceApi, seatsApi, roomIds, openCount);

  const { seatRooms, locked } = useMemo(
    () =>
      popupRooms({
        rooms: input.rooms,
        seats: mySeats.seats,
        recent: myPresence.data?.recent ?? [],
        counts: extras.counts,
      }),
    [input.rooms, mySeats.seats, myPresence.data, extras.counts],
  );
  const thumbs = useMemo(() => {
    const out: Record<string, RoomThumb | null> = {};
    for (const [id, layout] of Object.entries(extras.layouts)) {
      const mine = mySeats.seats.filter((s) => s.roomId === id).map((s) => s.code);
      out[id] = layout ? roomThumb(layout, mine) : null;
    }
    return out;
  }, [extras.layouts, mySeats.seats]);

  async function checkIn(roomId: string) {
    setBusy(true);
    setError(null);
    const r = await presenceApi.checkIn(roomId);
    const outcome = checkInOutcome(r);
    if (r.ok) myPresence.apply(r.value);
    if (outcome.refreshPresence) void myPresence.refresh();
    if (outcome.reloadSeats) void mySeats.refresh();
    setError(outcome.errorCode);
    if (outcome.close) dispatch("checkedIn");
    setBusy(false);
  }

  const action = buttonAction({
    presence: myPresence.status,
    seatCount,
    active,
    seatRooms: mySeats.seats.map((s) => ({ roomId: s.roomId, code: s.roomCode })),
    shownCode,
  });

  async function press() {
    if (action.kind === "checkin") {
      await checkIn(action.roomId);
    } else if (action.kind === "openPopup") {
      setError(null);
      dispatch("openFromButton");
    } else if (action.kind === "checkout") {
      setBusy(true);
      setError(null);
      const r = await presenceApi.checkOut();
      if (r.ok) myPresence.apply(null);
      else setError(r.code);
      setBusy(false);
    } else if (action.kind === "retry") {
      void myPresence.reload();
    }
  }

  const open = phase === "open";
  return {
    popup: {
      open,
      seatRooms,
      locked,
      thumbs,
      selectedCode: initialSelection(seatRooms, shownCode),
      busy,
      errorCode: open ? error : null,
      onSelect: input.navigate,
      onCheckIn: (roomId) => void checkIn(roomId),
      onJustLook: () => {
        setError(null);
        dispatch("justLook");
      },
    },
    button: { action, busy, errorCode: open ? null : error, onPress: () => void press() },
  };
}
