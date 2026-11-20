"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomDto } from "@/lib/rooms/types";
import type { RoomsApi } from "./rooms-api";

type State = { status: "loading" | "error" | "ready"; rooms: RoomDto[]; errorCode: string | null };

/** Loads the room list. Stale responses (an older request, or after unmount) are dropped. */
export function useRooms(api: RoomsApi) {
  const [state, setState] = useState<State>({ status: "loading", rooms: [], errorCode: null });
  const counter = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const id = ++counter.current;
    const result = await api.list();
    if (!mounted.current || id !== counter.current) return;
    setState(
      result.ok
        ? { status: "ready", rooms: result.value, errorCode: null }
        : { status: "error", rooms: [], errorCode: result.code },
    );
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
