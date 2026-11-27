"use client";

import { useEffect, useRef } from "react";
import type { PixelLook } from "@/lib/sprites/pixel-look";
import { previewOps } from "../portal/pixel-look-preview";
import { tintedFrame } from "../roomlayout/paint";
import type { Atlas } from "../roomlayout/loadAtlas";

const SCALE = 2;
const SIZE = 32;

/** The head of a member's pixel character (front view), drawn from the sprite atlas. Decorative: the name sits next to it. */
export function PixelHead({ atlas, look }: { atlas: Atlas | null; look: PixelLook }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!atlas || !canvas) return;
    const preview = previewOps(atlas.manifest, look, "front");
    const ctx = canvas.getContext("2d");
    if (!preview || !ctx) return;
    canvas.width = preview.width * SCALE;
    canvas.height = preview.height * SCALE;
    ctx.imageSmoothingEnabled = false;
    ctx.scale(SCALE, SCALE);
    for (const op of preview.ops) {
      const frame = atlas.manifest.frames[op.key];
      const src = tintedFrame(atlas, op.key, op.tint);
      if (frame && src) ctx.drawImage(src, 0, 0, frame.w, frame.h, op.x, op.y, op.w, op.h);
    }
  }, [atlas, look]);
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-start justify-center overflow-hidden rounded-full bg-tile"
      style={{ width: SIZE, height: SIZE }}
    >
      {atlas ? <canvas ref={ref} style={{ imageRendering: "pixelated" }} /> : null}
    </span>
  );
}
