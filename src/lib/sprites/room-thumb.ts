import type { RoomLayout } from "./layout";

export type ThumbCell = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "floor" | "fixture" | "seat" | "mine";
};
export type RoomThumb = { w: number; h: number; cells: ThumbCell[] };

/**
 * A simplified mini-map of a layout for the check-in popup: floor zones as rectangles, fixtures and seats as one
 * tile each (footprints are ignored at thumbnail scale), the member's seats (by code) marked `mine`. Cells outside
 * the room are clipped; a room with no area gives null (the view shows a placeholder).
 */
export function roomThumb(layout: RoomLayout, mySeatCodes: readonly string[]): RoomThumb | null {
  const { w, h } = layout;
  if (!(w >= 1) || !(h >= 1)) return null;
  const mine = new Set(mySeatCodes);
  const cells: ThumbCell[] = [];
  const add = (x: number, y: number, cw: number, ch: number, kind: ThumbCell["kind"]) => {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(w, x + cw);
    const y1 = Math.min(h, y + ch);
    if (x1 > x0 && y1 > y0) cells.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind });
  };
  for (const f of layout.floors) add(f.x, f.y, f.w, f.h, "floor");
  for (const f of layout.fixtures) add(f.x, f.y, 1, 1, "fixture");
  for (const s of layout.seats) add(s.x, s.y, 1, 1, mine.has(s.code) ? "mine" : "seat");
  return { w, h, cells };
}
