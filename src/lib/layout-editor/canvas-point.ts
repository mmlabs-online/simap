import type { Zoom } from "@/lib/sprites/layout";
import { TILE, type Rect } from "@/lib/sprites/placement";
import type { Point } from "./tiles";

/**
 * Canvas offset in screen pixels to a tile. The canvas starts at `bounds` (sprite overhang can make it
 * negative), so the origin is added back. Not clamped: the cell may lie outside the room.
 */
export function canvasCell(offset: Point, bounds: Rect, zoom: Zoom): Point {
  return {
    x: Math.floor((offset.x / zoom + bounds.x) / TILE),
    y: Math.floor((offset.y / zoom + bounds.y) / TILE),
  };
}

/** Clamp a tile into the room (0..w-1, 0..h-1). */
export function clampTile(p: Point, w: number, h: number): Point {
  return { x: Math.min(Math.max(p.x, 0), w - 1), y: Math.min(Math.max(p.y, 0), h - 1) };
}

/** Canvas offset to a room tile, or null when the point is outside the room (not clamped). */
export function canvasTile(
  offset: Point,
  bounds: Rect,
  zoom: Zoom,
  w: number,
  h: number,
): Point | null {
  const { x, y } = canvasCell(offset, bounds, zoom);
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  return { x, y };
}
