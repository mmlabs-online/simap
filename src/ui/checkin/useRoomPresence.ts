"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomPresenceResponse } from "@/lib/presence/types";
import type { PresenceApi } from "./presence-api";

type State = {
  status: "loading" | "ready" | "error";
  data: RoomPresenceResponse | null;
  errorCode: string | null;
};
const INITIAL: State = { status: "loading", data: null, errorCode: null };

/** Who is checked in to one room today. Stale answers (older request, other room) are dropped. SIM-060 adds polling via `refresh`. */
export function useRoomPresence(api: PresenceApi, roomId: string | null) {
  const [state, setState] = useState<State>(INITIAL);
  const counter = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (quiet: boolean) => {
      const id = ++counter.current;
      if (roomId === null) {
        setState(INITIAL);
        return;
      }
      if (!quiet) setState(INITIAL);
      const r = await api.room(roomId);
      if (!mounted.current || id !== counter.current) return;
      if (r.ok) setState({ status: "ready", data: r.value, errorCode: null });
      else if (!quiet) setState({ status: "error", data: null, errorCode: r.code });
    },
    [api, roomId],
  );

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return { ...state, refresh };
}
