"use client";

import { useEffect, useMemo, useRef } from "react";
import type { AvatarView } from "@/lib/sprites/avatar";
import type { PixelLook } from "@/lib/sprites/pixel-look";
import type { Atlas } from "../roomlayout/loadAtlas";
import { tintedFrame } from "../roomlayout/paint";
import { previewOps } from "./pixel-look-preview";

export type LookPreviewProps = {
  atlas: Atlas | null;
  look: PixelLook;
  view: AvatarView;
  scale: 1 | 2 | 4;
  /** Hide the canvas from assistive tech (the surrounding control already has a name). */
  decorative?: boolean;
  label: string;
};

/** One preview of the character, drawn from the same atlas frames and tints as the room map. */
export function LookPreview({ atlas, look, view, scale, label, decorative }: LookPreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const box = useMemo(
    () => (atlas ? previewOps(atlas.manifest, look, view) : null),
    [atlas, look, view],
  );

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !atlas || !box) return;
    ctx.clearRect(0, 0, box.width * scale, box.height * scale);
    ctx.imageSmoothingEnabled = false;
    for (const op of box.ops) {
      const frame = tintedFrame(atlas, op.key, op.tint);
      if (frame) ctx.drawImage(frame, op.x * scale, op.y * scale, op.w * scale, op.h * scale);
    }
  }, [atlas, box, scale]);

  if (!atlas || !box) {
    return (
      <span
        aria-busy={atlas ? undefined : true}
        className="inline-block rounded bg-surface-container"
        style={{ width: 32 * scale, height: 32 * scale }}
      />
    );
  }
  const width = box.width * scale;
  const height = box.height * scale;
  return (
    <canvas
      ref={ref}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      width={width}
      height={height}
      style={{ width, height, imageRendering: "pixelated" }}
    />
  );
}
