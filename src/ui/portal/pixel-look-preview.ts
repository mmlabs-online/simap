import { avatarFrames, type AvatarView } from "@/lib/sprites/avatar";
import { lookFromChoice, type PixelLook } from "@/lib/sprites/pixel-look";
import type { SpriteManifest } from "@/lib/sprites/types";

export type PreviewOp = { key: string; tint: string; x: number; y: number; w: number; h: number };

/**
 * Where each avatar layer sits in a box that just fits the character, in atlas pixels. Same frames, order and tints
 * as the room map, placed by the manifest anchors. Null when a frame is missing from the manifest.
 */
export function previewOps(
  manifest: SpriteManifest,
  look: PixelLook,
  view: AvatarView,
): { width: number; height: number; ops: PreviewOp[] } | null {
  const frames = avatarFrames(lookFromChoice(look), view);
  const found = frames.map((f) => ({ ...f, frame: manifest.frames[f.key] }));
  if (found.some((f) => !f.frame)) return null;
  const minX = Math.min(...found.map((f) => f.frame!.anchor[0]));
  const minY = Math.min(...found.map((f) => f.frame!.anchor[1]));
  const maxX = Math.max(...found.map((f) => f.frame!.anchor[0] + f.frame!.w));
  const maxY = Math.max(...found.map((f) => f.frame!.anchor[1] + f.frame!.h));
  return {
    width: maxX - minX,
    height: maxY - minY,
    ops: found.map((f) => ({
      key: f.key,
      tint: f.tint,
      x: f.frame!.anchor[0] - minX,
      y: f.frame!.anchor[1] - minY,
      w: f.frame!.w,
      h: f.frame!.h,
    })),
  };
}
