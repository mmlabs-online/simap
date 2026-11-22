"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomsApi } from "../rooms/rooms-api";
import { useRooms } from "../rooms/useRooms";
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
 * during a retry. Detail is fetched each time a seat opens so the panel shows current data (SEA-05).
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
    setList(
      result.ok
        ? {
            status: "ready",
            seats: result.value.items,
            truncated: result.value.truncated,
            errorCode: null,
          }
        : { status: "error", seats: [], truncated: false, errorCode: result.code },
    );
  }, [roomId, seatsApi]);

  useEffect(() => {
    void reloadSeats();
  }, [reloadSeats]);

  const openId =
    openCode === null ? null : (list.seats.find((s) => s.code === openCode)?.id ?? null);

  const loadDetail = useCallback(() => {
    if (openId === null) return;
    const id = ++detailCounter.current;
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

  // A 404 on the seat list means the room was deleted after the room list loaded.
  const roomGone = list.status === "error" && list.errorCode === "not_found";
  return {
    resolution: roomGone ? ({ kind: "missing" } as const) : resolution,
    list,
    detail,
    reloadRooms: rooms.reload,
    reloadSeats,
    retryDetail: loadDetail,
  };
}
