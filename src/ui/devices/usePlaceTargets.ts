"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SeatDto } from "@/lib/seats/types";
import type { RoomsApi } from "../rooms/rooms-api";
import { useRooms } from "../rooms/useRooms";
import type { SeatsApi } from "../seats/seats-api";

export type PlaceSeats = {
  status: "idle" | "loading" | "error" | "ready";
  seats: SeatDto[];
  truncated: boolean;
  errorCode: string | null;
};

const IDLE: PlaceSeats = { status: "idle", seats: [], truncated: false, errorCode: null };

/** Rooms, and the seats of the chosen room. Stale seat answers (an older room, or after unmount) are dropped. */
export function usePlaceTargets(
  roomsApi: RoomsApi,
  seatsApi: SeatsApi,
  initialRoomId: string | null,
) {
  const rooms = useRooms(roomsApi);
  const [roomId, setRoomId] = useState<string | null>(initialRoomId);
  const [seats, setSeats] = useState<PlaceSeats>(IDLE);
  const counter = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadSeats = useCallback(async () => {
    const id = ++counter.current;
    if (roomId === null) return setSeats(IDLE);
    setSeats({ ...IDLE, status: "loading" });
    const result = await seatsApi.list(roomId);
    if (!mounted.current || id !== counter.current) return;
    setSeats(
      result.ok
        ? {
            status: "ready",
            seats: result.value.items,
            truncated: result.value.truncated,
            errorCode: null,
          }
        : { ...IDLE, status: "error", errorCode: result.code },
    );
  }, [roomId, seatsApi]);

  useEffect(() => {
    void loadSeats();
  }, [loadSeats]);

  return { rooms, roomId, setRoomId, seats, retrySeats: loadSeats };
}
