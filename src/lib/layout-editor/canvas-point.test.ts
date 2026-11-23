import { describe, expect, it } from "vitest";
import { canvasTile } from "./canvas-point";

const bounds = { x: 0, y: 0, w: 320, h: 256 };

describe("canvasTile", () => {
  it("maps an offset to a tile at zoom 2, 3, 4", () => {
    expect(canvasTile({ x: 64, y: 0 }, bounds, 2, 10, 8)).toEqual({ x: 1, y: 0 });
    expect(canvasTile({ x: 95, y: 96 }, bounds, 3, 10, 8)).toEqual({ x: 0, y: 1 });
    expect(canvasTile({ x: 255, y: 128 }, bounds, 4, 10, 8)).toEqual({ x: 1, y: 1 });
  });

  it("adds negative bounds.x/y (sprite overhang) before converting", () => {
    const b = { x: -32, y: -64, w: 352, h: 320 };
    expect(canvasTile({ x: 64, y: 128 }, b, 2, 10, 8)).toEqual({ x: 0, y: 0 });
    expect(canvasTile({ x: 128, y: 128 }, b, 2, 10, 8)).toEqual({ x: 1, y: 0 });
    expect(canvasTile({ x: 0, y: 0 }, b, 2, 10, 8)).toBeNull();
  });

  it("returns null left of / above / past the room", () => {
    expect(canvasTile({ x: -1, y: 10 }, bounds, 2, 10, 8)).toBeNull();
    expect(canvasTile({ x: 10, y: -1 }, bounds, 2, 10, 8)).toBeNull();
    expect(canvasTile({ x: 640, y: 10 }, bounds, 2, 10, 8)).toBeNull();
    expect(canvasTile({ x: 10, y: 512 }, bounds, 2, 10, 8)).toBeNull();
    expect(canvasTile({ x: 639, y: 511 }, bounds, 2, 10, 8)).toEqual({ x: 9, y: 7 });
  });
});
