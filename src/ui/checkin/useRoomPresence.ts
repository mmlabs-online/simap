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

/** Who is checked in to one room today. Stale answers (older request, other room) are dropped. `refresh` refetches without a skeleton, keeps the data on failure and resolves to true when the read worked (polling, SIM-060). */
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
    async (quiet: boolean): Promise<boolean> => {
      const id = ++counter.current;
      if (roomId === null) {
        setState(INITIAL);
        return false;
      }
      if (!quiet) setState(INITIAL);
      const r = await api.room(roomId);
      if (!mounted.current || id !== counter.current) return r.ok;
      if (r.ok) setState({ status: "ready", data: r.value, errorCode: null });
      else if (!quiet) setState({ status: "error", data: null, errorCode: r.code });
      return r.ok;
    },
    [api, roomId],
  );

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return { ...state, refresh };
}
