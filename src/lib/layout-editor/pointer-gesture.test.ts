import { describe, expect, it } from "vitest";
import { draftFromLayout } from "./draft";
import {
  dragPreview,
  gestureCancel,
  gestureDown,
  gestureMove,
  gestureUp,
  marqueeBox,
  marqueeKeys,
  type DownSample,
  type Gesture,
  type GestureCtx,
  type PointerSample,
} from "./pointer-gesture";
import type { Tool } from "./place-tool";
import { registryFootprints, type FootprintLookup } from "@/lib/validate/layout";

const draft = draftFromLayout(
  {
    w: 12,
    h: 8,
    floors: [],
    seats: [
      { id: "a", code: "R-01", sprite: "desk.single", x: 2, y: 2, rotation: 0 },
      { id: "b", code: "R-02", sprite: "desk.single", x: 6, y: 2, rotation: 0 },
    ],
    fixtures: [{ id: "", sprite: "plant.large", x: 9, y: 5, rotation: 0 }],
  },
  [],
);
const A = "s:a";
const B = "s:b";
const P = "f:0";
const idle: Gesture = { kind: "idle" };
const ctx = (over: Partial<GestureCtx> = {}): GestureCtx => ({
  draft,
  selection: [],
  tool: null,
  frozen: false,
  ...over,
});
const at = (cx: number, cy: number, over: Partial<PointerSample> = {}): PointerSample => ({
  id: 1,
  offset: { x: cx * 64 + 5, y: cy * 64 + 5 },
  cell: { x: cx, y: cy },
  shift: false,
  ...over,
});
const down = (cx: number, cy: number, over: Partial<DownSample> = {}): DownSample => ({
  ...at(cx, cy),
  primary: true,
  button: 0,
  pointerType: "mouse",
  ...over,
});
const press = (cx: number, cy: number, c = ctx(), over: Partial<DownSample> = {}) =>
  gestureDown(idle, down(cx, cy, over), c).gesture;
const fixture: Tool = { kind: "fixture", sprite: "plant.large" };

describe("gestureDown", () => {
  it("down ignores a non-primary pointer, a non-left button, and a second pointer while a gesture runs", () => {
    expect(gestureDown(idle, down(2, 2, { primary: false }), ctx()).gesture).toBe(idle);
    expect(gestureDown(idle, down(2, 2, { button: 2 }), ctx()).gesture).toBe(idle);
    const g = press(2, 2);
    expect(g.kind).toBe("press");
    expect(gestureDown(g, down(5, 5, { id: 2 }), ctx()).gesture).toBe(g);
  });
});

describe("press and release", () => {
  it("press and release without moving: on an item selects it (shift toggles), on an empty tile or outside the room clears the selection, shift on empty space keeps it (no effect)", () => {
    const onItem = gestureUp(press(2, 2), at(2, 2), ctx());
    expect(onItem.effects).toEqual([{ type: "select", key: A, additive: false }]);
    expect(onItem.gesture.kind).toBe("idle");
    // the second tile of the 2x1 desk hits it as well
    const shifted = gestureUp(press(3, 2, ctx(), { shift: true }), at(3, 2), ctx());
    expect(shifted.effects).toEqual([{ type: "select", key: A, additive: true }]);
    expect(gestureUp(press(0, 0), at(0, 0), ctx()).effects).toEqual([{ type: "selectNone" }]);
    expect(gestureUp(press(20, 20), at(20, 20), ctx()).effects).toEqual([{ type: "selectNone" }]);
    const shiftEmpty = gestureUp(press(0, 0, ctx(), { shift: true }), at(0, 0), ctx());
    expect(shiftEmpty.effects).toEqual([]);
  });

  it("armed tool: release places at the tile, outside the room emits nothing, moving never starts a drag or a marquee", () => {
    const c = ctx({ tool: fixture });
    expect(gestureUp(press(2, 2, c), at(2, 2), c).effects).toEqual([{ type: "place", x: 2, y: 2 }]);
    expect(gestureUp(press(20, 2, c), at(20, 2), c).effects).toEqual([]);
    const g = press(2, 2, c);
    expect(gestureMove(g, at(5, 5), c).gesture).toBe(g);
    const e = press(0, 0, c);
    expect(gestureMove(e, at(5, 5), c).gesture).toBe(e);
    expect(gestureUp(g, at(5, 5), c).effects).toEqual([{ type: "place", x: 5, y: 5 }]);
  });

  it("touch: press only; a tap selects, moving never drags or draws a marquee", () => {
    const g = press(2, 2, ctx(), { pointerType: "touch" });
    expect(gestureMove(g, at(6, 6), ctx()).gesture).toBe(g);
    expect(gestureUp(g, at(2, 2), ctx()).effects).toEqual([
      { type: "select", key: A, additive: false },
    ]);
    const e = press(0, 0, ctx(), { pointerType: "touch" });
    expect(gestureMove(e, at(6, 6), ctx()).gesture).toBe(e);
  });

  it("frozen: a press never becomes a drag and still selects on release; a marquee still selects", () => {
    const c = ctx({ frozen: true });
    const g = press(2, 2, c);
    expect(gestureMove(g, at(5, 5), c).gesture).toBe(g);
    expect(gestureUp(g, at(5, 5), c).effects).toEqual([
      { type: "select", key: A, additive: false },
    ]);
    const m = gestureUp(press(0, 0, c), at(4, 3), c);
    expect(m.effects).toEqual([{ type: "selectMany", keys: [A], additive: false }]);
  });
});

describe("threshold and drag", () => {
  it("movement under 4 px on the same tile stays a press; 4 px or a tile change starts a drag on an item and a marquee on empty space", () => {
    const g = press(2, 2);
    const near: PointerSample = { ...at(2, 2), offset: { x: 133 + 3, y: 133 } };
    expect(gestureMove(g, near, ctx()).gesture).toBe(g);
    const four = gestureMove(g, { ...at(2, 2), offset: { x: 133 + 4, y: 133 } }, ctx());
    expect(four.gesture.kind).toBe("drag");
    expect(gestureMove(g, at(3, 2), ctx()).gesture.kind).toBe("drag");
    const e = press(0, 0);
    expect(gestureMove(e, { ...at(0, 0), offset: { x: 5 + 4, y: 5 } }, ctx()).gesture.kind).toBe(
      "marquee",
    );
    expect(gestureMove(e, at(0, 1), ctx()).gesture.kind).toBe("marquee");
  });

  it("drag from an unselected item emits selectMany [hit] (shift: selection + hit) and drags those keys; from a selected item drags the whole selection with no select effect", () => {
    const c = ctx({ selection: [B] });
    const plain = gestureMove(press(2, 2, c), at(4, 2), c);
    expect(plain.effects).toEqual([{ type: "selectMany", keys: [A], additive: false }]);
    expect(plain.gesture).toMatchObject({ kind: "drag", keys: [A] });
    const sh = gestureMove(press(2, 2, c, { shift: true }), at(4, 2), c);
    expect(sh.effects).toEqual([{ type: "selectMany", keys: [B, A], additive: false }]);
    const c2 = ctx({ selection: [A, B] });
    const sel = gestureMove(press(2, 2, c2), at(4, 2), c2);
    expect(sel.effects).toEqual([]);
    expect(sel.gesture).toMatchObject({ kind: "drag", keys: [A, B] });
  });

  it("drag release emits one move with the whole-tile delta from unclamped tiles (also past the room edge); a zero delta emits nothing", () => {
    const c = ctx({ selection: [A] });
    const g = gestureMove(press(2, 2, c), at(4, 3), c).gesture;
    const up = gestureUp(g, at(4, 3), c);
    expect(up.effects).toEqual([{ type: "move", dx: 2, dy: 1 }]);
    expect(up.gesture.kind).toBe("idle");
    const far = gestureUp(g, at(-3, 12), c);
    expect(far.effects).toEqual([{ type: "move", dx: -5, dy: 10 }]);
    const back = gestureMove(g, at(2, 2), c).gesture;
    expect(gestureUp(back, at(2, 2), c).effects).toEqual([]);
  });

  it("release applies the release position first: a press released 3 tiles away with no move event in between emits selectMany then move", () => {
    const up = gestureUp(press(2, 2), at(5, 2), ctx());
    expect(up.effects).toEqual([
      { type: "selectMany", keys: [A], additive: false },
      { type: "move", dx: 3, dy: 0 },
    ]);
  });

  it("move returns the same gesture object while the tile does not change", () => {
    const c = ctx({ selection: [A] });
    const g = gestureMove(press(2, 2, c), at(4, 2), c).gesture;
    expect(gestureMove(g, { ...at(4, 2), offset: { x: 4 * 64 + 40, y: 9 } }, c).gesture).toBe(g);
    const m = gestureMove(press(0, 0), at(3, 3), ctx()).gesture;
    expect(gestureMove(m, at(3, 3), ctx()).gesture).toBe(m);
    expect(gestureMove(m, at(30, 3), ctx()).gesture).toMatchObject({ cell: { x: 11, y: 3 } });
  });
});

describe("marquee", () => {
  it("marquee in either direction selects the itemsInRect keys with tiles clamped into the room; shift gives additive; an empty rectangle without shift gives selectMany [] (clears)", () => {
    const fwd = gestureUp(press(0, 0), at(7, 3), ctx());
    expect(fwd.effects).toEqual([{ type: "selectMany", keys: [A, B], additive: false }]);
    const back = gestureUp(press(7, 3), at(0, 0), ctx());
    expect(back.effects).toEqual([{ type: "selectMany", keys: [A, B], additive: false }]);
    const clamped = gestureUp(press(11, 7), at(-5, -5), ctx());
    expect(clamped.effects).toEqual([{ type: "selectMany", keys: [A, B, P], additive: false }]);
    const sh = gestureUp(press(0, 0, ctx(), { shift: true }), at(7, 3), ctx());
    expect(sh.effects[0]).toMatchObject({ additive: true });
    const empty = gestureUp(press(0, 5), at(3, 7), ctx());
    expect(empty.effects).toEqual([{ type: "selectMany", keys: [], additive: false }]);
  });

  it("marqueeBox gives the normalised tile rect; marqueeKeys matches itemsInRect", () => {
    const g = gestureMove(press(7, 3), at(5, 1), ctx()).gesture;
    expect(marqueeBox(g)).toEqual({ x: 5, y: 1, w: 3, h: 3 });
    expect(marqueeKeys(draft, g)).toEqual([B]);
    expect(marqueeBox(idle)).toBeNull();
    expect(marqueeKeys(draft, idle)).toEqual([]);
  });
});

describe("cancel and other pointers", () => {
  it("cancel from press, drag and marquee returns idle with no effects; move and up of another pointerId are ignored", () => {
    const c = ctx({ selection: [A] });
    const p = press(2, 2, c);
    const d = gestureMove(p, at(4, 2), c).gesture;
    const m = gestureMove(press(0, 0), at(3, 3), ctx()).gesture;
    for (const g of [p, d, m]) {
      expect(gestureCancel()).toEqual(idle);
      expect(gestureMove(g, at(6, 6, { id: 2 }), c)).toEqual({ gesture: g, effects: [] });
      expect(gestureUp(g, at(6, 6, { id: 2 }), c)).toEqual({ gesture: g, effects: [] });
    }
    expect(gestureUp(idle, at(1, 1), c)).toEqual({ gesture: idle, effects: [] });
  });
});

describe("dragPreview", () => {
  it("dragPreview: null for a non-drag or zero delta; boxes are the footprint boxes shifted by the delta; ok is false for overlap and off-room, the same as moveItems", () => {
    const c = ctx({ selection: [A] });
    const g = (x: number, y: number) => gestureMove(press(2, 2, c), at(x, y), c).gesture;
    expect(dragPreview(draft, idle)).toBeNull();
    expect(dragPreview(draft, press(2, 2, c))).toBeNull();
    expect(dragPreview(draft, gestureMove(g(4, 2), at(2, 2), c).gesture)).toBeNull();
    expect(dragPreview(draft, g(4, 3))).toEqual({
      ok: true,
      boxes: [{ x: 4, y: 3, w: 2, h: 1 }],
    });
    expect(dragPreview(draft, g(6, 2))?.ok).toBe(false);
    expect(dragPreview(draft, g(-1, 2))?.ok).toBe(false);
  });
});

describe("catalog lookup", () => {
  const wide: FootprintLookup = (k) => (k === "plant.large" ? [4, 1] : registryFootprints(k));

  it("gestureDown hit and marquee use ctx.footprints; dragPreview boxes have the catalog size", () => {
    const sample = (x: number): DownSample => ({
      id: 1,
      offset: { x: 0, y: 0 },
      cell: { x, y: 5 },
      shift: false,
      primary: true,
      button: 0,
      pointerType: "mouse",
    });
    const hit = (c: GestureCtx, x: number) => {
      const g = gestureDown(idle, sample(x), c).gesture;
      return g.kind === "press" ? g.hit : "none";
    };
    expect(hit(ctx({ footprints: wide }), 12)).toBeNull();
    expect(hit(ctx({ footprints: wide }), 11)).toBe(P);
    const m: Gesture = {
      kind: "marquee",
      id: 1,
      cell0: { x: 11, y: 5 },
      cell: { x: 11, y: 5 },
      additive: false,
    };
    expect(marqueeKeys(draft, m, wide)).toEqual([P]);
    expect(marqueeKeys(draft, m)).toEqual([]);
    const drag: Gesture = {
      kind: "drag",
      id: 1,
      cell0: { x: 0, y: 0 },
      cell: { x: -1, y: 0 },
      keys: [P],
    };
    expect(dragPreview(draft, drag, wide)?.boxes[0]).toMatchObject({ w: 4, h: 1 });
  });
});
