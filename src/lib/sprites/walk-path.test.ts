import { describe, expect, it } from "vitest";
import { catalogFootprints } from "@/lib/map-items/footprints";
import { registryFootprints } from "@/lib/validate/layout";
import type { Placement, RoomLayout, Rotation } from "./layout";
import { findPath, pathFromDoor, walkGrid, type Tile, type WalkGrid } from "./walk-path";

const room = (over: Partial<RoomLayout> = {}): RoomLayout => ({
  w: 7,
  h: 5,
  floors: [],
  seats: [],
  fixtures: [],
  ...over,
});
const desk = (id: string, x: number, y: number, rotation: Rotation = 0) => ({
  id,
  code: id,
  sprite: "desk.single",
  x,
  y,
  rotation,
});
const fx = (
  id: string,
  sprite: string,
  x: number,
  y: number,
  rotation: Rotation = 0,
): Placement => ({ id, sprite, x, y, rotation });
const grid = (layout: RoomLayout) => walkGrid(layout, registryFootprints);
const isBlocked = (g: WalkGrid, t: Tile) => g.blocked[t.y * g.w + t.x] === 1;
const adjacent = (a: Tile, b: Tile) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
const door = fx("door", "door", 0, 0);
const plant = (id: string, x: number, y: number) => fx(id, "plant.large", x, y);

function pathOf(layout: RoomLayout, seat = "s") {
  const g = grid(layout);
  const r = pathFromDoor(g, seat);
  if (!r.ok) throw new Error(r.reason);
  return { g, path: r.path };
}

describe("walkGrid and pathFromDoor", () => {
  it("finds a path from the door entry tile to the chair", () => {
    const { g, path } = pathOf(room({ seats: [desk("s", 4, 1)], fixtures: [door] }));
    expect(g.chairs.s).toMatchObject({ x: 4, y: 2, key: "chair.office.n" });
    expect(g.entries).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
    ]);
    expect(g.entries).toContainEqual(path[0]);
    expect(path.at(-1)).toEqual({ x: 4, y: 2 });
    for (let i = 1; i < path.length; i++) expect(adjacent(path[i - 1], path[i])).toBe(true);
  });

  it("avoids blocking tiles: the path goes around a wall of plants", () => {
    const plants = [0, 1, 2, 3].map((y) => plant(`p${y}`, 2, y));
    const { g, path } = pathOf(room({ seats: [desk("s", 4, 1)], fixtures: [door, ...plants] }));
    expect(path.some((t) => t.y === 4)).toBe(true);
    for (const t of path.slice(0, -1)) expect(isBlocked(g, t)).toBe(false);
  });

  it("door tiles are never on the path; the path starts on a free tile next to the door", () => {
    const { g, path } = pathOf(room({ seats: [desk("s", 4, 1)], fixtures: [door] }));
    expect(isBlocked(g, { x: 0, y: 0 })).toBe(true);
    expect(isBlocked(g, { x: 0, y: 1 })).toBe(true);
    expect(path.some((t) => t.x === 0 && t.y < 2)).toBe(false);
    const doorTiles = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(doorTiles.some((d) => adjacent(d, path[0]))).toBe(true);
  });

  it("without a door, or with a door whose neighbours are all blocked, there is no door", () => {
    expect(pathFromDoor(grid(room({ seats: [desk("s", 4, 1)] })), "s")).toEqual({
      ok: false,
      reason: "no_door",
    });
    const plug = [plant("a", 1, 0), plant("b", 1, 1), plant("c", 0, 2)];
    const g = grid(room({ seats: [desk("s", 4, 1)], fixtures: [door, ...plug] }));
    expect(g.entries).toEqual([]);
    expect(pathFromDoor(g, "s")).toEqual({ ok: false, reason: "no_door" });
  });

  it("a seat without a chair in the room has no chair", () => {
    const g = grid(room({ seats: [desk("s", 4, 1)], fixtures: [door] }));
    expect(pathFromDoor(g, "missing")).toEqual({ ok: false, reason: "no_chair" });
  });

  it("a chair walled in by blocking items is unreachable", () => {
    const walls = [plant("a", 3, 2), plant("b", 5, 2), plant("c", 4, 3)];
    const g = grid(room({ seats: [desk("s", 4, 1)], fixtures: [door, ...walls] }));
    expect(pathFromDoor(g, "s")).toEqual({ ok: false, reason: "unreachable" });
  });

  it("with two doors only one reaches the chair: the path starts there", () => {
    // Door B (6,3)-(6,4) is sealed in by plants; its entry tiles are not connected to the chair.
    const seal = [plant("a", 4, 3), plant("b", 4, 4), plant("c", 5, 2), plant("d", 6, 1)];
    const doorB = fx("doorB", "door", 6, 3);
    const { path, g } = pathOf(
      room({ seats: [desk("s", 4, 1)], fixtures: [door, doorB, ...seal] }),
    );
    expect(g.entries.some((t) => t.x >= 5)).toBe(true);
    expect(path[0].x).toBeLessThanOrEqual(1);
  });

  it("with two doors that both reach the chair the nearer one wins", () => {
    const doorB = fx("doorB", "door", 6, 0);
    const near = pathOf(room({ seats: [desk("s", 1, 1)], fixtures: [door, doorB] }));
    expect(near.path[0].x).toBeLessThanOrEqual(1);
    const far = pathOf(room({ seats: [desk("s", 4, 1)], fixtures: [door, doorB] }));
    expect(far.path[0].x).toBeGreaterThanOrEqual(5);
  });

  it("is deterministic: the same input gives the same path, neighbours go north, west, east, south", () => {
    const layout = room({ seats: [desk("s", 4, 1)], fixtures: [door] });
    expect(pathOf(layout).path).toEqual(pathOf(layout).path);
    const open = { w: 3, h: 3, blocked: new Uint8Array(9) };
    expect(findPath(open, [{ x: 0, y: 0 }], { x: 2, y: 2 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  it("a chair enclosed on three sides is reached through the open side", () => {
    const walls = [plant("a", 3, 2), plant("b", 5, 2)];
    const { path } = pathOf(room({ seats: [desk("s", 4, 1)], fixtures: [door, ...walls] }));
    expect(path.at(-2)).toEqual({ x: 4, y: 3 });
    expect(path.at(-1)).toEqual({ x: 4, y: 2 });
  });

  it("non-blocking items do not block; tiles outside the room are not walkable", () => {
    const g = grid(room({ fixtures: [fx("k", "prop.keyboard", 3, 3), plant("p", 2, 3)] }));
    expect(isBlocked(g, { x: 3, y: 3 })).toBe(false);
    expect(isBlocked(g, { x: 2, y: 3 })).toBe(true);
    expect(findPath(g, [{ x: -1, y: 0 }], { x: 1, y: 1 })).toBeNull();
    expect(findPath(g, [{ x: 0, y: 0 }], { x: 7, y: 0 })).toBeNull();
  });

  it("the catalog footprint wins and rotation 90 swaps width and height", () => {
    const lookup = catalogFootprints(
      [
        { builtinKey: "plant.large", w: 2, h: 2 },
        { builtinKey: "desk.single", w: 3, h: 1 },
      ],
      registryFootprints,
    );
    const g = walkGrid(
      room({ seats: [desk("s", 1, 1, 90)], fixtures: [plant("p", 4, 3)] }),
      lookup,
    );
    for (const [x, y] of [
      [4, 3],
      [5, 3],
      [4, 4],
      [5, 4],
    ]) {
      expect(isBlocked(g, { x, y })).toBe(true);
    }
    for (const y of [1, 2, 3]) expect(isBlocked(g, { x: 1, y })).toBe(true);
    expect(isBlocked(g, { x: 2, y: 1 })).toBe(false);
    expect(g.chairs.s).toMatchObject({ x: 2, y: 2, key: "chair.office.w" });
  });

  it("a door is found by its base sprite at every rotation, with or without a catalog row", () => {
    const rows = catalogFootprints([{ builtinKey: "door", w: 1, h: 2 }], registryFootprints);
    for (const rotation of [0, 90, 180, 270] as const) {
      const layout = room({ fixtures: [fx("d", "door", 3, 2, rotation)] });
      expect(grid(layout).entries.length).toBeGreaterThan(0);
      expect(walkGrid(layout, rows).entries.length).toBeGreaterThan(0);
    }
  });

  it("chair to chair: a path between two chairs, null when the goal is walled in", () => {
    const seats = [desk("a", 1, 1), desk("b", 5, 1)];
    const g = grid(room({ seats }));
    const path = findPath(g, [g.chairs.a], g.chairs.b);
    expect(path?.[0]).toEqual({ x: 1, y: 2 });
    expect(path?.at(-1)).toEqual({ x: 5, y: 2 });
    const walled = grid(
      room({ seats, fixtures: [plant("a", 4, 2), plant("b", 6, 2), plant("c", 5, 3)] }),
    );
    expect(findPath(walled, [walled.chairs.a], walled.chairs.b)).toBeNull();
  });
});
