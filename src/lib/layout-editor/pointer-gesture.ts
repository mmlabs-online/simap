import { clampTile } from "./canvas-point";
import { moveItems } from "./draft";
import type { EditorAction } from "./editor-state";
import type { Tool } from "./place-tool";
import { footprintBox, itemAt, itemsInRect, type Point } from "./tiles";
import type { Draft } from "./types";

/** Pointer travel (screen px) that turns a press into a drag or a marquee; a tile change also does. */
export const DRAG_THRESHOLD_PX = 4;

/** `offset` is the canvas offset in px; `cell` is the unclamped tile under it (`canvasCell`). */
export type PointerSample = { id: number; offset: Point; cell: Point; shift: boolean };
export type DownSample = PointerSample & { primary: boolean; button: number; pointerType: string };
export type GestureCtx = {
  draft: Draft;
  selection: readonly string[];
  tool: Tool | null;
  frozen: boolean;
};

export type Gesture =
  | { kind: "idle" }
  | {
      kind: "press";
      id: number;
      origin: Point;
      cell: Point;
      hit: string | null;
      shift: boolean;
      canDrag: boolean;
      canMarquee: boolean;
    }
  | { kind: "drag"; id: number; cell0: Point; cell: Point; keys: string[] }
  | { kind: "marquee"; id: number; cell0: Point; cell: Point; additive: boolean };

export type GestureEffect = Extract<
  EditorAction,
  { type: "select" | "selectNone" | "selectMany" | "move" | "place" }
>;
export type GestureStep = { gesture: Gesture; effects: GestureEffect[] };
export type Box = { x: number; y: number; w: number; h: number };

const IDLE: Gesture = { kind: "idle" };
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const inRoom = (d: Draft, c: Point) => c.x >= 0 && c.y >= 0 && c.x < d.w && c.y < d.h;
const stay = (gesture: Gesture): GestureStep => ({ gesture, effects: [] });

export function gestureDown(g: Gesture, s: DownSample, ctx: GestureCtx): GestureStep {
  if (g.kind !== "idle" || !s.primary || s.button !== 0) return stay(g);
  const touch = s.pointerType === "touch";
  return stay({
    kind: "press",
    id: s.id,
    origin: s.offset,
    cell: s.cell,
    hit: inRoom(ctx.draft, s.cell) ? (itemAt(ctx.draft, s.cell.x, s.cell.y)?.key ?? null) : null,
    shift: s.shift,
    canDrag: !ctx.tool && !ctx.frozen && !touch,
    canMarquee: !ctx.tool && !touch,
  });
}

export function gestureMove(g: Gesture, s: PointerSample, ctx: GestureCtx): GestureStep {
  if (g.kind === "idle" || g.id !== s.id) return stay(g);
  if (g.kind === "press") {
    const moved = Math.hypot(s.offset.x - g.origin.x, s.offset.y - g.origin.y);
    if (moved < DRAG_THRESHOLD_PX && same(s.cell, g.cell)) return stay(g);
    if (g.hit !== null && g.canDrag) {
      if (ctx.selection.includes(g.hit)) {
        return stay({
          kind: "drag",
          id: g.id,
          cell0: g.cell,
          cell: s.cell,
          keys: [...ctx.selection],
        });
      }
      const keys = g.shift ? [...ctx.selection, g.hit] : [g.hit];
      return {
        gesture: { kind: "drag", id: g.id, cell0: g.cell, cell: s.cell, keys },
        effects: [{ type: "selectMany", keys, additive: false }],
      };
    }
    if (g.hit === null && g.canMarquee) {
      const { w, h } = ctx.draft;
      return stay({
        kind: "marquee",
        id: g.id,
        cell0: clampTile(g.cell, w, h),
        cell: clampTile(s.cell, w, h),
        additive: g.shift,
      });
    }
    return stay(g);
  }
  const cell = g.kind === "marquee" ? clampTile(s.cell, ctx.draft.w, ctx.draft.h) : s.cell;
  return same(cell, g.cell) ? stay(g) : stay({ ...g, cell });
}

export function gestureUp(g: Gesture, s: PointerSample, ctx: GestureCtx): GestureStep {
  if (g.kind === "idle" || g.id !== s.id) return stay(g);
  // The release position counts first, so the result never depends on the last animation frame.
  const m = gestureMove(g, s, ctx);
  const end = m.gesture;
  const effects = [...m.effects];
  if (end.kind === "press") {
    if (ctx.tool) {
      if (inRoom(ctx.draft, s.cell)) effects.push({ type: "place", x: s.cell.x, y: s.cell.y });
    } else if (end.hit !== null) {
      effects.push({ type: "select", key: end.hit, additive: end.shift });
    } else if (!end.shift) {
      effects.push({ type: "selectNone" });
    }
  } else if (end.kind === "drag") {
    const dx = end.cell.x - end.cell0.x;
    const dy = end.cell.y - end.cell0.y;
    if (dx !== 0 || dy !== 0) effects.push({ type: "move", dx, dy });
  } else if (end.kind === "marquee") {
    effects.push({ type: "selectMany", keys: marqueeKeys(ctx.draft, end), additive: end.additive });
  }
  return { gesture: IDLE, effects };
}

export const gestureCancel = (): Gesture => IDLE;

/** The drop ghost: one footprint box per dragged item at the target, and whether the drop would commit. */
export function dragPreview(draft: Draft, g: Gesture): { ok: boolean; boxes: Box[] } | null {
  if (g.kind !== "drag") return null;
  const dx = g.cell.x - g.cell0.x;
  const dy = g.cell.y - g.cell0.y;
  if (dx === 0 && dy === 0) return null;
  const boxes = draft.items
    .filter((i) => g.keys.includes(i.key))
    .map((i) => {
      const b = footprintBox(i);
      return { ...b, x: b.x + dx, y: b.y + dy };
    });
  return { ok: moveItems(draft, g.keys, dx, dy).ok, boxes };
}

/** The marquee as a normalised tile rectangle. */
export function marqueeBox(g: Gesture): Box | null {
  if (g.kind !== "marquee") return null;
  const x = Math.min(g.cell0.x, g.cell.x);
  const y = Math.min(g.cell0.y, g.cell.y);
  return { x, y, w: Math.abs(g.cell0.x - g.cell.x) + 1, h: Math.abs(g.cell0.y - g.cell.y) + 1 };
}

export function marqueeKeys(draft: Draft, g: Gesture): string[] {
  if (g.kind !== "marquee") return [];
  return itemsInRect(draft, g.cell0, g.cell).map((i) => i.key);
}
