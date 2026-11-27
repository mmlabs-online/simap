"use client";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { IDLE_MS, idlePainters, idleTicking, walksDone } from "@/lib/sprites/idle";
import type { IdleSeat, Rect } from "@/lib/sprites/placement";
import { walkerOps, walkFrame, type ActiveWalk } from "@/lib/sprites/walk";
import type { Atlas } from "./loadAtlas";
import { paintWalkers } from "./paint";

type Props = {
  atlas: Atlas;
  walks: readonly ActiveWalk[];
  /** Present seated characters that bob (typing idle, PRE-06). */
  idle: readonly IdleSeat[];
  bounds: Rect;
  zoom: number;
  /** Called once every walk has reached its end (or the layer cannot paint). */
  onDone: () => void;
  /** Called when the layer cannot paint the idle characters. */
  onIdleFail: () => void;
};

const subscribeVisibility = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};

/**
 * The walking and typing characters (PRE-07, PRE-06): a second canvas over the room. It repaints per frame while a
 * walk runs, and about twice a second (a 1 px bob) while a present character sits at a monitor. The tab hidden stops it.
 */
export function WalkLayer({ atlas, walks, idle, bounds, zoom, onDone, onIdleFail }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ atlas, walks, idle, bounds, zoom, onDone, onIdleFail });
  latest.current = { atlas, walks, idle, bounds, zoom, onDone, onIdleFail };

  const draw = () => {
    const canvas = ref.current;
    const cur = latest.current;
    if (!canvas) return false;
    const now = performance.now();
    const frames = cur.walks.map((w) => ({ w, f: walkFrame(w, now) }));
    const ok = paintWalkers(canvas, cur.atlas, cur.bounds, cur.zoom, [
      ...idlePainters(cur.idle, now),
      ...frames.map(({ w, f }) => ({
        ops: walkerOps(cur.atlas.manifest, w.who, f.view, f.x, f.y, f.bob, f.walk),
        alpha: f.alpha,
      })),
    ]);
    if (!ok) {
      if (cur.idle.length > 0) cur.onIdleFail();
      if (cur.walks.length > 0) cur.onDone();
      return false;
    }
    if (walksDone(frames.map(({ f }) => f))) {
      cur.onDone();
      return false;
    }
    return cur.walks.length > 0;
  };

  // The first frame is painted before the browser paints, so the walker is there the moment the seat is hidden.
  useLayoutEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walks, idle, bounds, zoom]);

  const walking = walks.length > 0;
  useEffect(() => {
    if (!walking) return;
    let id = 0;
    const loop = () => {
      if (draw()) id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walking]);

  const hidden = useSyncExternalStore(
    subscribeVisibility,
    () => document.hidden,
    () => false,
  );
  const ticking = idleTicking({ seats: idle.length, hidden });
  useEffect(() => {
    if (!ticking) return;
    draw();
    // While walking, the frame loop already paints the idle seats.
    const id = setInterval(() => {
      if (latest.current.walks.length === 0) draw();
    }, IDLE_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticking]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0"
      style={{
        width: bounds.w * zoom,
        height: bounds.h * zoom,
        imageRendering: "pixelated",
      }}
    />
  );
}
