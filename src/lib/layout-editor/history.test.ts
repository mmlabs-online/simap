import { describe, expect, it } from "vitest";
import { draftFromLayout, moveItems, placeItem } from "./draft";
import { UNDO_LIMIT, canUndo, commit, startHistory, undo } from "./history";
import type { Draft } from "./types";

const start = (): Draft =>
  draftFromLayout({ w: 64, h: 64, floors: [], seats: [], fixtures: [] }, []);

describe("history", () => {
  it("commit then undo restores the previous draft; undo at the start is a no-op", () => {
    const d0 = start();
    const r = placeItem(d0, "plant.large", 1, 1);
    if (!r.ok) throw new Error("refused");
    let h = commit(startHistory(d0), r.draft);
    expect(canUndo(h)).toBe(true);
    expect(h.present.items).toHaveLength(1);
    h = undo(h);
    expect(h.present).toBe(d0);
    expect(canUndo(h)).toBe(false);
    expect(undo(h)).toBe(h);
  });

  it("a refused op is not committed (no step)", () => {
    const h = startHistory(start());
    const r = placeItem(h.present, "plant.large", 64, 0);
    const next = r.ok ? commit(h, r.draft) : h;
    expect(r.ok).toBe(false);
    expect(next).toBe(h);
    expect(canUndo(next)).toBe(false);
  });

  it("the stack keeps the last 50 steps", () => {
    const placed = placeItem(start(), "plant.large", 0, 0);
    if (!placed.ok) throw new Error("refused");
    let h = startHistory(placed.draft);
    for (let n = 0; n < UNDO_LIMIT + 10; n++) {
      const r = moveItems(h.present, ["f:0"], 1, 0);
      if (!r.ok) throw new Error("refused");
      h = commit(h, r.draft);
    }
    expect(h.past).toHaveLength(UNDO_LIMIT);
    for (let n = 0; n < UNDO_LIMIT; n++) h = undo(h);
    expect(canUndo(h)).toBe(false);
    expect(h.present.items[0].x).toBe(10);
  });

  it("startHistory(saved draft) clears past steps", () => {
    const d = start();
    const r = placeItem(d, "plant.large", 1, 1);
    if (!r.ok) throw new Error("refused");
    const h = startHistory(commit(startHistory(d), r.draft).present);
    expect(canUndo(h)).toBe(false);
  });
});
