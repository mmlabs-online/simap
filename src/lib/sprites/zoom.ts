import { ZOOM_LEVELS, type Zoom } from "./layout";

/** Canvas budget: the iOS Safari area limit (16,777,216 px, about 67 MB of RGBA) and a side limit. */
export const MAX_CANVAS_AREA = 16_777_216;
export const MAX_CANVAS_SIDE = 8_192;

/** True when a canvas of `w` x `h` device pixels is inside the budget. */
export function fitsCanvas(w: number, h: number): boolean {
  return w > 0 && h > 0 && w <= MAX_CANVAS_SIDE && h <= MAX_CANVAS_SIDE && w * h <= MAX_CANVAS_AREA;
}

/** The zoom levels whose canvas fits the budget for a map of `bounds` (room px). Always a prefix of `ZOOM_LEVELS`. */
export function allowedZooms(bounds: { w: number; h: number }): Zoom[] {
  return ZOOM_LEVELS.filter((z) => fitsCanvas(bounds.w * z, bounds.h * z));
}

/** The largest allowed level at or below `requested`, else the smallest allowed, else null. */
export function clampZoom(requested: number, allowed: readonly Zoom[]): Zoom | null {
  if (allowed.length === 0) return null;
  const below = allowed.filter((z) => z <= requested);
  return below.length > 0 ? below[below.length - 1] : allowed[0];
}
