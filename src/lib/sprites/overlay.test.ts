import { describe, expect, it } from "vitest";
import { overlayFor, tagPlacement } from "./overlay";

describe("overlayFor", () => {
  it("maps each of the five states", () => {
    expect(overlayFor("empty", [2, 1])).toEqual([]);
    expect(overlayFor("occupied", [2, 1])).toEqual([]);
    expect(overlayFor("pending", [2, 1])).toEqual([
      { key: "state.pending", target: "chair", tile: [0, 0], offset: [0, -24] },
    ]);
    expect(overlayFor("cannot", [2, 1])).toEqual([
      { key: "state.cannot", target: "desk", tile: [0, 0], offset: [0, -8] },
    ]);
    expect(overlayFor("mine", [1, 1]).map((o) => o.key)).toEqual(["state.mine.tint"]);
  });

  it("mine emits one tint per desk tile", () => {
    const tiles = overlayFor("mine", [2, 1]).map((o) => o.tile);
    expect(tiles).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(overlayFor("mine", [1, 2]).map((o) => o.tile)).toEqual([
      [0, 0],
      [0, 1],
    ]);
  });
});

describe("tagPlacement", () => {
  it("tag flips below when tileY < 2", () => {
    expect(tagPlacement(0, 300, 600).side).toBe("below");
    expect(tagPlacement(1, 300, 600).side).toBe("below");
    expect(tagPlacement(2, 300, 600).side).toBe("above");
  });

  it("tag aligns start or end near the left and right edges", () => {
    expect(tagPlacement(5, 79, 600).align).toBe("start");
    expect(tagPlacement(5, 80, 600).align).toBe("center");
    expect(tagPlacement(5, 521, 600).align).toBe("end");
    expect(tagPlacement(5, 520, 600).align).toBe("center");
  });
});
