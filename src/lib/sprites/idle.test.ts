import { describe, expect, it } from "vitest";
import { idleBob, idleOn, idlePainters, idleTicking, walksDone } from "./idle";
import type { IdleSeat } from "./placement";

const op = (y: number) => ({
  type: "frame" as const,
  layer: "avatar" as const,
  key: "avatar.body",
  tint: null,
  x: 10,
  y,
  w: 8,
  h: 8,
});

describe("idle", () => {
  it("idleBob alternates 0/1 every 500 ms", () => {
    expect([0, 499, 500, 999, 1000].map(idleBob)).toEqual([0, 0, 1, 1, 0]);
  });

  it("idlePainters lifts every op of every idle seat by the bob", () => {
    const idle: IdleSeat[] = [
      { seatId: "a", ops: [op(20), op(30)] },
      { seatId: "b", ops: [op(40)] },
    ];
    const copy = structuredClone(idle);
    expect(idlePainters(idle, 0)).toEqual([
      { ops: idle[0].ops, alpha: 1 },
      { ops: idle[1].ops, alpha: 1 },
    ]);
    const up = idlePainters(idle, 500);
    expect(up.map((p) => p.ops.map((o) => [o.x, o.y]))).toEqual([
      [
        [10, 19],
        [10, 29],
      ],
      [[10, 39]],
    ]);
    expect(up.every((p) => p.alpha === 1)).toBe(true);
    expect(idlePainters([], 500)).toEqual([]);
    expect(idle).toEqual(copy);
  });

  it("idleOn is false under reduced motion", () => {
    expect(idleOn({ presenceView: true, reduced: true, failed: false })).toBe(false);
  });

  it("idleOn is false outside the presence view / after a paint failure", () => {
    expect(idleOn({ presenceView: false, reduced: false, failed: false })).toBe(false);
    expect(idleOn({ presenceView: true, reduced: false, failed: true })).toBe(false);
    expect(idleOn({ presenceView: true, reduced: false, failed: false })).toBe(true);
  });

  it("idleTicking: false with no idle seats, false while the document is hidden, true otherwise", () => {
    expect(idleTicking({ seats: 0, hidden: false })).toBe(false);
    expect(idleTicking({ seats: 2, hidden: true })).toBe(false);
    expect(idleTicking({ seats: 2, hidden: false })).toBe(true);
  });

  it("walksDone is false for an empty walk list", () => {
    expect(walksDone([])).toBe(false);
    expect(walksDone([{ done: true }, { done: true }])).toBe(true);
    expect(walksDone([{ done: true }, { done: false }])).toBe(false);
  });
});
