"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MapLoadState } from "@/lib/sprites/map-view";
import { keepRowsOnError } from "./seat-actions";
import type { SeatsApi } from "./seats-api";

const LOADING: MapLoadState = { status: "loading", view: null, errorCode: null };

/**
 * Loads the room's layout once the room id is known. Stale responses are dropped; after a first
 * success the old map stays on screen during a reload and after a transient failure.
 */
export function useRoomLayout(seatsApi: SeatsApi, roomId: string | null) {
  const [state, setState] = useState<MapLoadState>(LOADING);
  const counter = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (roomId === null) return;
    const id = ++counter.current;
    const result = await seatsApi.layout(roomId);
    if (!mounted.current || id !== counter.current) return;
    setState((prev) =>
      result.ok
        ? { status: "ready", view: result.value, errorCode: null }
        : {
            status: "error",
            view: keepRowsOnError(result.code) ? prev.view : null,
            errorCode: result.code,
          },
    );
  }, [roomId, seatsApi]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload };
}
