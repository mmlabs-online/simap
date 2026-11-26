"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomLayout } from "@/lib/sprites/layout";
import type { SeatsApi } from "../seats/seats-api";
import type { PresenceApi } from "./presence-api";

export type PopupExtras = {
  /** Members checked in now per room id; null = the read failed. */
  counts: Record<string, number | null>;
  /** Layout per room id; null = the read failed. */
  layouts: Record<string, RoomLayout | null>;
};
const EMPTY: PopupExtras = { counts: {}, layouts: {} };

/**
 * Loads the count and layout of each seat room once per popup opening (`openCount` is bumped on every open; 0 =
 * never opened). A failed room gives null for that value. Stale answers are dropped.
 */
export function usePopupExtras(
  presenceApi: PresenceApi,
  seatsApi: SeatsApi,
  roomIds: readonly string[],
  openCount: number,
): PopupExtras {
  const [extras, setExtras] = useState<PopupExtras>(EMPTY);
  const ids = useRef(roomIds);
  ids.current = roomIds;

  useEffect(() => {
    if (openCount === 0) return;
    let live = true;
    void (async () => {
      const rows = await Promise.all(
        ids.current.map(async (id) => {
          const [presence, layout] = await Promise.all([presenceApi.room(id), seatsApi.layout(id)]);
          return [
            id,
            presence.ok ? presence.value.members.length : null,
            layout.ok ? layout.value.layout : null,
          ] as const;
        }),
      );
      if (!live) return;
      setExtras({
        counts: Object.fromEntries(rows.map(([id, count]) => [id, count])),
        layouts: Object.fromEntries(rows.map(([id, , layout]) => [id, layout])),
      });
    })();
    return () => {
      live = false;
    };
  }, [presenceApi, seatsApi, openCount]);

  return extras;
}
