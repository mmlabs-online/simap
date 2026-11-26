"use client";

import { useCallback, useRef, useState } from "react";
import { moveOutcome } from "@/lib/presence/move";
import type { MyPresenceDto } from "@/lib/presence/types";
import type { PresenceApi } from "./presence-api";

/** Moves the viewer's presence to another own seat of the room (PRE-03). One move at a time; a refusal is never retried. */
export function usePresenceMove({
  api,
  apply,
  refreshMine,
  reloadLayout,
}: {
  api: PresenceApi;
  apply: (presence: MyPresenceDto | null) => void;
  refreshMine: () => Promise<boolean>;
  reloadLayout: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const running = useRef(false);

  const move = useCallback(
    async (seatId: string) => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      setErrorCode(null);
      try {
        const out = moveOutcome(await api.move(seatId));
        if (out.apply) apply(out.apply.presence);
        if (out.refreshMine) void refreshMine();
        if (out.reloadLayout) reloadLayout();
        setErrorCode(out.errorCode);
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [api, apply, refreshMine, reloadLayout],
  );

  return { busy, errorCode, move };
}
