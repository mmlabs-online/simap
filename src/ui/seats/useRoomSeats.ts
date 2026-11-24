"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomsApi } from "../rooms/rooms-api";
import { useRooms } from "../rooms/useRooms";
import { keepRowsOnError } from "./seat-actions";
import type { SeatsApi } from "./seats-api";
import {
  resolveRoom,
  type RoomResolution,
  type SeatDetailState,
  type SeatListState,
} from "./seat-view";

const EMPTY_LIST: SeatListState = {
  status: "loading",
  seats: [],
  truncated: false,
  errorCode: null,
};
const EMPTY_DETAIL: SeatDetailState = {
  seatId: null,
  status: "loading",
  seat: null,
  errorCode: null,
};

/**
 * Loads the room (code to id from the room list), then its seats, then the detail of the open seat.
 * The seats endpoint is not called until the room resolves. Stale responses are dropped; rows stay
 * during a retry and after a transient failure. Detail is fetched each time a seat opens so the panel shows current data (SEA-05).
 */
export function useRoomSeats(
  roomsApi: RoomsApi,
  seatsApi: SeatsApi,
  roomCode: string,
  openCode: string | null,
) {
  const rooms = useRooms(roomsApi);
  const [list, setList] = useState<SeatListState>(EMPTY_LIST);
  const [detail, setDetail] = useState<SeatDetailState>(EMPTY_DETAIL);
  const listCounter = useRef(0);
  const detailCounter = useRef(0);
  const mounted = useRef(true);
  const openIdRef = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const resolution: RoomResolution = resolveRoom(rooms, roomCode);
  const roomId = resolution.kind === "found" ? resolution.room.id : null;

  const reloadSeats = useCallback(async () => {
    if (roomId === null) return;
    const id = ++listCounter.current;
    setList((prev) => ({ ...prev, status: "loading", errorCode: null }));
    const result = await seatsApi.list(roomId);
    if (!mounted.current || id !== listCounter.current) return;
    setList((prev) =>
      result.ok
        ? {
            status: "ready",
            seats: result.value.items,
            truncated: result.value.truncated,
            errorCode: null,
          }
        : {
            status: "error",
            seats: keepRowsOnError(result.code) ? prev.seats : [],
            truncated: keepRowsOnError(result.code) ? prev.truncated : false,
            errorCode: result.code,
          },
    );
  }, [roomId, seatsApi]);

  useEffect(() => {
    void reloadSeats();
  }, [reloadSeats]);

  const openId =
    openCode === null ? null : (list.seats.find((s) => s.code === openCode)?.id ?? null);

  useEffect(() => {
    openIdRef.current = openId;
  }, [openId]);

  const loadDetail = useCallback(() => {
    const id = ++detailCounter.current;
    if (openId === null) {
      setDetail(EMPTY_DETAIL);
      return;
    }
    setDetail({ seatId: openId, status: "loading", seat: null, errorCode: null });
    void seatsApi.get(openId).then((result) => {
      if (!mounted.current || id !== detailCounter.current) return;
      setDetail(
        result.ok
          ? { seatId: openId, status: "ready", seat: result.value, errorCode: null }
          : { seatId: openId, status: "error", seat: null, errorCode: result.code },
      );
    });
  }, [openId, seatsApi]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Refetches the open seat without the loading flip. It reads the current seat from a ref so a
  // seat opened meanwhile is never cancelled; a failure shows the error, never the old seat.
  const refreshDetail = useCallback(async () => {
    const seatId = openIdRef.current;
    if (seatId === null) return;
    const id = ++detailCounter.current;
    const result = await seatsApi.get(seatId);
    if (!mounted.current || id !== detailCounter.current) return;
    setDetail(
      result.ok
        ? { seatId, status: "ready", seat: result.value, errorCode: null }
        : { seatId, status: "error", seat: null, errorCode: result.code },
    );
  }, [seatsApi]);

  const refresh = useCallback(
    () => Promise.all([reloadSeats(), refreshDetail()]).then(() => undefined),
    [reloadSeats, refreshDetail],
  );

  // A 404 on the seat list means the room was deleted after the room list loaded.
  const roomGone = list.status === "error" && list.errorCode === "not_found";
  return {
    resolution: roomGone ? ({ kind: "missing" } as const) : resolution,
    list,
    detail,
    reloadRooms: rooms.reload,
    reloadSeats,
    retryDetail: loadDetail,
    refresh,
  };
}
