"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { Rect } from "@/lib/sprites/placement";
import { walkerOps, walkFrame, type ActiveWalk } from "@/lib/sprites/walk";
import type { Atlas } from "./loadAtlas";
import { paintWalkers } from "./paint";

type Props = {
  atlas: Atlas;
  walks: readonly ActiveWalk[];
  bounds: Rect;
  zoom: number;
  /** Called once every walk has reached its end (or the layer cannot paint). */
  onDone: () => void;
};

/** The walking characters (PRE-07): a second canvas over the room, repainted per frame only while a walk runs. */
export function WalkLayer({ atlas, walks, bounds, zoom, onDone }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ atlas, walks, bounds, zoom, onDone });
  latest.current = { atlas, walks, bounds, zoom, onDone };

  const draw = () => {
    const canvas = ref.current;
    const cur = latest.current;
    if (!canvas) return false;
    const now = performance.now();
    const frames = cur.walks.map((w) => ({ w, f: walkFrame(w, now) }));
    const ok = paintWalkers(
      canvas,
      cur.atlas,
      cur.bounds,
      cur.zoom,
      frames.map(({ w, f }) => ({
        ops: walkerOps(cur.atlas.manifest, w.who, f.view, f.x, f.y, f.bob, f.walk),
        alpha: f.alpha,
      })),
    );
    if (!ok || frames.every(({ f }) => f.done)) {
      cur.onDone();
      return false;
    }
    return true;
  };

  // The first frame is painted before the browser paints, so the walker is there the moment the seat is hidden.
  useLayoutEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walks, bounds, zoom]);

  useEffect(() => {
    let id = 0;
    const loop = () => {
      if (draw()) id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
