import { describe, expect, it } from "vitest";
import { draftFromLayout } from "./draft";
import { dragDelta, itemAt, itemsInRect, pointToTile } from "./tiles";

const fx = (sprite: string, x: number, y: number) => ({
  id: "",
  sprite,
  x,
  y,
  rotation: 0 as const,
});
const seat = (id: string, x: number, y: number) => ({
  id,
  code: "R-01",
  sprite: "desk.single",
  x,
  y,
  rotation: 0 as const,
});

describe("pointToTile", () => {
  it("pointToTile maps pixels to tiles at zoom 2, 3, 4 (64, 96, 128 px per tile)", () => {
    expect(pointToTile({ x: 63, y: 64 }, 2, 12, 8)).toEqual({ x: 0, y: 1 });
    expect(pointToTile({ x: 95, y: 96 }, 3, 12, 8)).toEqual({ x: 0, y: 1 });
    expect(pointToTile({ x: 255, y: 256 }, 4, 12, 8)).toEqual({ x: 1, y: 2 });
    expect(pointToTile({ x: 128, y: 128 }, 4, 12, 8)).toEqual({ x: 1, y: 1 });
  });

  it("pointToTile clamps negative and past-the-edge points into 0..w-1 / 0..h-1", () => {
    expect(pointToTile({ x: -5, y: -900 }, 2, 12, 8)).toEqual({ x: 0, y: 0 });
    expect(pointToTile({ x: 99999, y: 99999 }, 3, 12, 8)).toEqual({ x: 11, y: 7 });
  });
});

describe("dragDelta", () => {
  it("dragDelta is a whole-tile difference and 0 below one tile, also for negative drags", () => {
    expect(dragDelta({ x: 10, y: 10 }, { x: 140, y: 70 }, 2)).toEqual({ x: 2, y: 1 });
    expect(dragDelta({ x: 10, y: 10 }, { x: 60, y: 60 }, 2)).toEqual({ x: 0, y: 0 });
    expect(dragDelta({ x: 70, y: 70 }, { x: 65, y: 65 }, 2)).toEqual({ x: 0, y: 0 });
    expect(dragDelta({ x: 70, y: 70 }, { x: 10, y: 10 }, 2)).toEqual({ x: -1, y: -1 });
    expect(dragDelta({ x: 100, y: 100 }, { x: 100, y: 100 + 96 }, 3)).toEqual({ x: 0, y: 1 });
  });
});

describe("hit tests", () => {
  const draft = draftFromLayout(
    {
      w: 12,
      h: 8,
      floors: [],
      seats: [seat("a", 2, 2)],
      fixtures: [fx("plant.large", 2, 2), fx("plant.small", 8, 6)],
    },
    [],
  );

  it("itemAt returns the topmost item whose footprint covers the tile (seat over fixture), null on empty tile", () => {
    expect(itemAt(draft, 2, 2)?.kind).toBe("seat");
    expect(itemAt(draft, 3, 2)?.kind).toBe("seat");
    expect(itemAt(draft, 8, 6)?.sprite).toBe("plant.small");
    expect(itemAt(draft, 0, 0)).toBeNull();
  });

  it("itemsInRect selects items whose footprint intersects the rectangle, in either drag direction", () => {
    const keys = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      itemsInRect(draft, a, b)
        .map((i) => i.key)
        .sort();
    expect(keys({ x: 3, y: 3 }, { x: 1, y: 1 })).toEqual(["f:0", "s:a"]);
    expect(keys({ x: 1, y: 1 }, { x: 3, y: 3 })).toEqual(["f:0", "s:a"]);
    expect(keys({ x: 3, y: 0 }, { x: 3, y: 0 })).toEqual([]);
    expect(keys({ x: 0, y: 0 }, { x: 11, y: 7 })).toHaveLength(3);
  });
});
