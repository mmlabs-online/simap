import { describe, expect, it } from "vitest";
import type { RoomLayout } from "./layout";
import { roomThumb } from "./room-thumb";

const layout = (over: Partial<RoomLayout> = {}): RoomLayout => ({
  w: 10,
  h: 6,
  floors: [{ sprite: "f", x: 0, y: 0, w: 10, h: 6 }],
  seats: [
    { id: "1", code: "A-01", sprite: "s", x: 2, y: 2, rotation: 0 },
    { id: "2", code: "A-02", sprite: "s", x: 4, y: 2, rotation: 0 },
  ],
  fixtures: [{ id: "f1", sprite: "plant", x: 9, y: 5, rotation: 0 }],
  ...over,
});

describe("roomThumb", () => {
  it("floors become w x h cells, fixtures one cell each, seats one cell, the member's seats (by code) marked mine", () => {
    const t = roomThumb(layout(), ["A-02"]);
    expect(t).toEqual({
      w: 10,
      h: 6,
      cells: [
        { x: 0, y: 0, w: 10, h: 6, kind: "floor" },
        { x: 9, y: 5, w: 1, h: 1, kind: "fixture" },
        { x: 2, y: 2, w: 1, h: 1, kind: "seat" },
        { x: 4, y: 2, w: 1, h: 1, kind: "mine" },
      ],
    });
  });
  it("cells outside w/h are clipped; w or h < 1 -> null (placeholder)", () => {
    const t = roomThumb(
      layout({
        floors: [{ sprite: "f", x: -2, y: 4, w: 20, h: 5 }],
        fixtures: [{ id: "f1", sprite: "p", x: 10, y: 0, rotation: 0 }],
        seats: [],
      }),
      [],
    );
    expect(t?.cells).toEqual([{ x: 0, y: 4, w: 10, h: 2, kind: "floor" }]);
    expect(roomThumb(layout({ w: 0 }), [])).toBeNull();
    expect(roomThumb(layout({ h: 0 }), [])).toBeNull();
  });
});
