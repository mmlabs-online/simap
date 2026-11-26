"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPoller } from "@/lib/presence/poll";

type Refresher = { refresh: () => Promise<boolean> };

/**
 * Polls the room and own presence every 45 s (60 s after a failure) while the tab is visible (D76). The first loads
 * come from the data hooks. `stale` is true after repeated failures; `refreshNow` loads at once and restarts the wait.
 */
export function usePresencePoll(roomId: string | null, room: Refresher, mine: Refresher) {
  const [stale, setStale] = useState(false);
  const latest = useRef({ room, mine });
  const poller = useRef<ReturnType<typeof createPoller> | null>(null);

  useEffect(() => {
    latest.current = { room, mine };
  });

  useEffect(() => {
    setStale(false);
    if (roomId === null) return;
    const p = createPoller({
      load: async () => {
        const [roomOk] = await Promise.all([
          latest.current.room.refresh(),
          latest.current.mine.refresh(),
        ]);
        return roomOk;
      },
      isVisible: () => document.visibilityState === "visible",
      now: () => Date.now(),
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (h) => window.clearTimeout(h as number),
      onStale: setStale,
    });
    poller.current = p;
    document.addEventListener("visibilitychange", p.visibilityChanged);
    p.start();
    return () => {
      document.removeEventListener("visibilitychange", p.visibilityChanged);
      p.dispose();
      if (poller.current === p) poller.current = null;
    };
  }, [roomId]);

  const refreshNow = useCallback(() => poller.current?.refreshNow() ?? Promise.resolve(), []);
  return { stale, refreshNow };
}
