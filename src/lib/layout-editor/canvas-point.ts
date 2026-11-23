import type { Zoom } from "@/lib/sprites/layout";
import { TILE, type Rect } from "@/lib/sprites/placement";
import type { Point } from "./tiles";

/**
 * Canvas offset in screen pixels to a room tile. The canvas starts at `bounds` (sprite overhang can make
 * it negative), so the origin is added back. Null when the point is outside the room (not clamped).
 */
export function canvasTile(
  offset: Point,
  bounds: Rect,
  zoom: Zoom,
  w: number,
  h: number,
): Point | null {
  const x = Math.floor((offset.x / zoom + bounds.x) / TILE);
  const y = Math.floor((offset.y / zoom + bounds.y) / TILE);
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  return { x, y };
}
