"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SeatPresence } from "@/lib/presence/seat-presence";
import type { SeatView } from "@/lib/sprites/layout";
import {
  hiddenSeats,
  isSkipEvent,
  NO_WALKS,
  presenceStep,
  skipAll,
  startWalks,
  type Baseline,
  type WalkState,
} from "@/lib/sprites/walk";
import type { WalkGrid } from "@/lib/sprites/walk-path";

type Input = {
  roomId: string;
  presence: Readonly<Record<string, SeatPresence>> | undefined;
  seatViews: Readonly<Record<string, SeatView>>;
  grid: WalkGrid | null;
  reduced: boolean;
};

/**
 * Walk-in, walk-out and move animations (PRE-07), derived from the changes between two presence answers. Runs in a
 * layout effect so the seats being walked to are hidden before the browser paints the new presence. A click or any key
 * ends every walk at once; reduced motion shows the end state.
 */
export function useWalks({ roomId, presence, seatViews, grid, reduced }: Input) {
  const [state, setState] = useState<WalkState>(NO_WALKS);
  const baseline = useRef<Baseline | null>(null);

  useLayoutEffect(() => {
    const step = presenceStep(baseline.current, { roomId, presence, views: seatViews });
    baseline.current = step.baseline;
    if (step.intents.length === 0 || !grid) return;
    setState((s) => startWalks(s, step.intents, grid, performance.now(), { reduced }));
    // A walk starts only from a change of the answer; the grid, views and motion setting are read as of that change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, presence]);

  useEffect(() => {
    if (reduced) setState(skipAll);
  }, [reduced]);

  const active = state.walks.length > 0;
  useEffect(() => {
    if (!active) return;
    const skip = (e: Event) => {
      if (isSkipEvent(e as { type: string; key?: string })) setState(skipAll);
    };
    window.addEventListener("pointerdown", skip, { passive: true });
    window.addEventListener("keydown", skip, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [active]);

  // Keyed by value so a walk that changes nothing for the static layer does not rebuild the draw list.
  const hiddenKey = [...hiddenSeats(state)].sort().join("|");
  const hidden = useMemo(() => new Set(hiddenKey ? hiddenKey.split("|") : []), [hiddenKey]);
  const finish = useCallback(() => setState(skipAll), []);
  return { walks: state.walks, hidden, finish };
}
