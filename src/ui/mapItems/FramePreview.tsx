"use client";

import { useEffect, useRef } from "react";
import type { Atlas } from "../roomlayout/loadAtlas";
import { atlasFrame, containRect, frameRect } from "./frame-preview";

/** One atlas frame on a pixelated canvas: at an integer `scale`, or fitted in a square `box`. Renders nothing for a missing frame. */
export function FramePreview({
  atlas,
  frameKey,
  scale,
  box,
  label,
}: {
  atlas: Atlas;
  frameKey: string;
  scale?: number;
  box?: number;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = atlasFrame(atlas.manifest.frames, frameKey);
  const fit = frame && box ? containRect(frame, box) : null;
  const r = fit ?? (frame && !box ? frameRect(frame, scale ?? 1) : null);
  const width = box ?? (r ? r.dw : 0);
  const height = box ?? (r ? r.dh : 0);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !r) return;
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = fit?.smooth ?? false;
    ctx.drawImage(atlas.image, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
  }, [atlas, r, width, height]);

  if (!r) return null;
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      width={width}
      height={height}
      className="shrink-0"
      style={{ imageRendering: "pixelated", width, height }}
    />
  );
}
