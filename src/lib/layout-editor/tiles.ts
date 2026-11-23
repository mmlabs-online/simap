import type { Zoom } from "@/lib/sprites/layout";
import { TILE } from "@/lib/sprites/placement";
import { footprintOf } from "@/lib/validate/layout";
import type { Draft, EditorItem } from "./types";

export type Point = { x: number; y: number };

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);

/** Pixel (room origin, on screen at `zoom`) to a tile, clamped into the room. */
export function pointToTile(p: Point, zoom: Zoom, w: number, h: number): Point {
  const px = TILE * zoom;
  return {
    x: clamp(Math.floor(p.x / px), w - 1),
    y: clamp(Math.floor(p.y / px), h - 1),
  };
}

/** Whole-tile difference between two pixel points, unclamped (the move refusal decides the bounds). */
export function dragDelta(start: Point, now: Point, zoom: Zoom): Point {
  const px = TILE * zoom;
  return {
    x: Math.floor(now.x / px) - Math.floor(start.x / px),
    y: Math.floor(now.y / px) - Math.floor(start.y / px),
  };
}

/** Tiles an item covers, from the registry footprint at its rotation. */
export function footprintCells(item: EditorItem): Point[] {
  const [fw, fh] = footprintOf(item.sprite, item.rotation) ?? [1, 1];
  const cells: Point[] = [];
  for (let dy = 0; dy < fh; dy++) {
    for (let dx = 0; dx < fw; dx++) cells.push({ x: item.x + dx, y: item.y + dy });
  }
  return cells;
}

/** Topmost item covering a tile: seats first, then fixtures, later items first. */
export function itemAt(draft: Draft, tx: number, ty: number): EditorItem | null {
  const covers = (i: EditorItem) => footprintCells(i).some((c) => c.x === tx && c.y === ty);
  for (const kind of ["seat", "fixture"] as const) {
    for (let n = draft.items.length - 1; n >= 0; n--) {
      const i = draft.items[n];
      if (i.kind === kind && covers(i)) return i;
    }
  }
  return null;
}

/** Items whose footprint intersects the tile rectangle between two tiles, in either drag direction. */
export function itemsInRect(draft: Draft, a: Point, b: Point): EditorItem[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  return draft.items.filter((i) =>
    footprintCells(i).some((c) => c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1),
  );
}
