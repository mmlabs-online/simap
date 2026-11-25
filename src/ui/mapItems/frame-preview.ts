import type { SpriteFrame } from "@/lib/sprites/types";

type Box = Pick<SpriteFrame, "x" | "y" | "w" | "h">;

export type FrameRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

/** The frame in a manifest, or null (own keys only). */
export function atlasFrame(
  frames: Record<string, SpriteFrame>,
  key: string | null,
): SpriteFrame | null {
  return key !== null && Object.hasOwn(frames, key) ? frames[key]! : null;
}

const usable = (f: Box) => f.w > 0 && f.h > 0;

/** Source and destination rects for a frame drawn at an integer scale; null for an unusable frame or scale. */
export function frameRect(f: Box, scale: number): FrameRect | null {
  if (!usable(f) || !Number.isInteger(scale) || scale <= 0) return null;
  return { sx: f.x, sy: f.y, sw: f.w, sh: f.h, dx: 0, dy: 0, dw: f.w * scale, dh: f.h * scale };
}

/** A frame fitted in a square box: smaller frames at 1x (sharp), larger ones scaled down (`smooth`); centred. */
export function containRect(f: Box, box: number): (FrameRect & { smooth: boolean }) | null {
  if (!usable(f)) return null;
  const scale = Math.min(1, box / f.w, box / f.h);
  const dw = f.w * scale;
  const dh = f.h * scale;
  return {
    sx: f.x,
    sy: f.y,
    sw: f.w,
    sh: f.h,
    dx: (box - dw) / 2,
    dy: (box - dh) / 2,
    dw,
    dh,
    smooth: scale < 1,
  };
}
