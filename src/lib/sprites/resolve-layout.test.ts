import { describe, expect, it } from "vitest";
import { catalogFootprints } from "@/lib/map-items/footprints";
import { checkLayoutRules, registryFootprints } from "@/lib/validate/layout";
import { REGISTRY } from "./registry";
import {
  parseStoredFloors,
  resolveLayout,
  type StoredFixture,
  type StoredPlacement,
  type StoredRoom,
  type StoredSeat,
} from "./resolve-layout";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = (x: number, y: number, sprite = "desk.single", rotation = 0): StoredPlacement => ({
  sprite,
  x,
  y,
  rotation,
});
const seat = (n: number, placement: StoredPlacement | null): StoredSeat => ({
  id: id(n),
  code: `S${n}`,
  placement,
});
const fixture = (n: number, p: StoredPlacement): StoredFixture => ({ id: id(1000 + n), ...p });
const floor = (w: number, h: number, over: Record<string, unknown> = {}) => ({
  sprite: "floor.wood",
  x: 0,
  y: 0,
  w,
  h,
  ...over,
});
const room = (over: Partial<StoredRoom> = {}): StoredRoom => ({
  gridW: 12,
  gridH: 8,
  floorZones: [floor(12, 8)],
  ...over,
});
const defaultFloor = [floor(12, 8)];

describe("resolveLayout unsaved", () => {
  it("null grid gives the default with saved false and ignores stray placements and fixtures", () => {
    const r = resolveLayout(
      room({ gridW: null, gridH: null }),
      [seat(1, at(5, 5)), seat(2, null)],
      [fixture(1, at(0, 0, "plant.large"))],
    );
    expect(r.saved).toBe(false);
    expect(r.unplaced).toEqual([]);
    expect(r.layout.fixtures).toEqual([]);
    expect(r.layout.seats.map((s) => [s.x, s.y])).toEqual([
      [0, 0],
      [3, 0],
    ]);
  });

  it("grid above 64 gives the default with saved false", () => {
    const r = resolveLayout(room({ gridW: 65 }), [seat(1, at(0, 0))], []);
    expect(r.saved).toBe(false);
    expect(checkLayoutRules(r.layout).ok).toBe(true);
  });
});

describe("resolveLayout saved room", () => {
  it("returns valid floors, seats and fixtures as stored, in input order", () => {
    const r = resolveLayout(
      room(),
      [seat(2, at(6, 2)), seat(1, at(0, 0))],
      [fixture(1, at(10, 6, "plant.large")), fixture(2, at(11, 6, "label.sign"))],
    );
    expect(r.saved).toBe(true);
    expect(r.unplaced).toEqual([]);
    expect(r.layout.w).toBe(12);
    expect(r.layout.floors).toEqual(defaultFloor);
    expect(r.layout.seats.map((s) => [s.id, s.code, s.x, s.y])).toEqual([
      [id(2), "S2", 6, 2],
      [id(1), "S1", 0, 0],
    ]);
    expect(r.layout.fixtures.map((f) => f.id)).toEqual([id(1001), id(1002)]);
  });

  it("an empty floors array stays empty", () => {
    expect(resolveLayout(room({ floorZones: [] }), [], []).layout.floors).toEqual([]);
  });
});

describe("corrupt floors", () => {
  const cases: [string, unknown][] = [
    ["non-array", { a: 1 }],
    ["over 64 zones", Array.from({ length: 65 }, () => floor(1, 1))],
    ["non-object element", [1]],
    ["missing key", [{ sprite: "floor.wood", x: 0, y: 0, w: 12 }]],
    ["extra key", [floor(12, 8, { extra: 1 })]],
    ["string coordinate", [floor(12, 8, { x: "0" })]],
    ["float coordinate", [floor(12, 8, { w: 11.5 })]],
    ["non-safe value", [floor(12, 8, { w: Number.POSITIVE_INFINITY })]],
    ["unknown sprite", [floor(12, 8, { sprite: "floor.nope" })]],
    ["prototype key sprite", [floor(12, 8, { sprite: "constructor" })]],
    ["non-floor sprite", [floor(12, 8, { sprite: "plant.large" })]],
    ["directional sprite", [floor(12, 8, { sprite: "door.e" })]],
    ["out of bounds", [floor(13, 8)]],
    ["over the cell cap", [floor(12, 8), floor(12, 8), floor(1, 1)]],
  ];

  it.each(cases)("%s gives the single default floor", (_name, raw) => {
    expect(parseStoredFloors(raw, 12, 8)).toEqual(defaultFloor);
  });

  it("output zones contain only the five known keys", () => {
    const out = parseStoredFloors([floor(6, 4)], 12, 8);
    expect(Object.keys(out[0]).sort()).toEqual(["h", "sprite", "w", "x", "y"]);
  });

  it("output always passes the rules", () => {
    for (const [, raw] of cases) {
      const r = resolveLayout(room({ floorZones: raw }), [seat(1, at(0, 0))], []);
      expect(checkLayoutRules(r.layout)).toEqual({ ok: true });
    }
  });
});

describe("corrupt sprites", () => {
  const bad = ["constructor", "__proto__", "desk.pair", "desk.single.e", "retired.key"];

  it("seat with constructor, __proto__, desk.pair, desk.single.e or a retired key moves to a free slot", () => {
    for (const sprite of bad) {
      const r = resolveLayout(room(), [seat(1, at(6, 4, sprite))], []);
      expect(r.unplaced).toEqual([]);
      expect(r.layout.seats[0]).toMatchObject({ sprite: "desk.single", x: 0, y: 0, rotation: 0 });
      expect(checkLayoutRules(r.layout)).toEqual({ ok: true });
    }
  });

  it("fixture with constructor, __proto__, door.e, floor.wood or a retired key is dropped", () => {
    for (const sprite of [...bad.slice(0, 2), "door.e", "floor.wood", "retired.key"]) {
      const r = resolveLayout(room(), [seat(1, at(0, 0))], [fixture(1, at(8, 6, sprite))]);
      expect(r.layout.fixtures).toEqual([]);
      expect(r.layout.seats).toHaveLength(1);
      expect(checkLayoutRules(r.layout)).toEqual({ ok: true });
    }
  });
});

describe("corrupt placement", () => {
  it("out-of-bounds seat, chair outside the room, and non-zero rotation on a single-frame fixture are handled", () => {
    const r = resolveLayout(
      room(),
      [seat(1, at(11, 0)), seat(2, at(0, 7)), seat(3, at(6, 0, "desk.single", 45))],
      [fixture(1, at(5, 5, "plant.large", 90))],
    );
    expect(r.layout.fixtures).toEqual([]);
    expect(r.layout.seats.map((s) => [s.id, s.x, s.y])).toEqual([
      [id(1), 0, 0],
      [id(2), 3, 0],
      [id(3), 6, 0],
    ]);
    expect(checkLayoutRules(r.layout)).toEqual({ ok: true });
  });
});

describe("overlap", () => {
  it("of two seats on one tile, the first in seq order stays and the second moves", () => {
    const r = resolveLayout(room(), [seat(1, at(3, 2)), seat(2, at(3, 2))], []);
    expect(r.layout.seats.map((s) => [s.id, s.x, s.y])).toEqual([
      [id(1), 3, 2],
      [id(2), 0, 0],
    ]);
  });

  it("a blocking fixture on a seat or its chair is dropped, the seat stays", () => {
    const r = resolveLayout(
      room(),
      [seat(1, at(0, 0))],
      [fixture(1, at(1, 0, "plant.large")), fixture(2, at(0, 1, "plant.large"))],
    );
    expect(r.layout.fixtures).toEqual([]);
    expect(r.layout.seats[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("a non-blocking fixture is still resolved on a seat or chair tile (stored data is kept; the rules flag the desk one, D62 A2)", () => {
    const r = resolveLayout(
      room(),
      [seat(1, at(0, 0))],
      [fixture(1, at(0, 0, "label.sign")), fixture(2, at(0, 1, "label.sign"))],
    );
    expect(r.layout.fixtures).toHaveLength(2);
    expect(checkLayoutRules(r.layout)).toEqual({ ok: false, code: "layout_fixture_on_desk" });
  });
});

describe("free slots", () => {
  it("a seat with null placement takes the first free slot and avoids kept fixtures and chairs", () => {
    const r = resolveLayout(
      room(),
      [seat(1, at(0, 0)), seat(2, null), seat(3, null)],
      [fixture(1, at(3, 0, "plant.large"))],
    );
    // slot (0,0) is taken by seat 1, slot (3,0) is blocked by the plant
    expect(r.layout.seats.map((s) => [s.id, s.x, s.y])).toEqual([
      [id(1), 0, 0],
      [id(2), 6, 0],
      [id(3), 9, 0],
    ]);
    expect(checkLayoutRules(r.layout)).toEqual({ ok: true });
  });

  it("uses the last column when only 2 tiles remain (w = 5 gives x = 0 and x = 3)", () => {
    const r = resolveLayout(
      room({ gridW: 5, gridH: 2, floorZones: [] }),
      [seat(1, null), seat(2, null), seat(3, null)],
      [],
    );
    expect(r.layout.seats.map((s) => [s.x, s.y])).toEqual([
      [0, 0],
      [3, 0],
    ]);
    expect(r.unplaced).toEqual([{ id: id(3), code: "S3" }]);
  });

  it("no free slot lists the seat in unplaced with id and code", () => {
    const r = resolveLayout(room({ gridW: 2, gridH: 2 }), [seat(1, null), seat(2, null)], []);
    expect(r.layout.seats.map((s) => s.id)).toEqual([id(1)]);
    expect(r.unplaced).toEqual([{ id: id(2), code: "S2" }]);
  });
});

describe("caps", () => {
  it("caps seats and fixtures at 500 and 2,000", () => {
    const seats = Array.from({ length: 501 }, (_, i) => seat(i + 1, null));
    const fixtures = Array.from({ length: 2001 }, (_, i) => fixture(i + 1, at(0, 0, "label.sign")));
    const r = resolveLayout(room({ gridW: 64, gridH: 64 }), seats, fixtures);
    expect(r.layout.seats.length + r.unplaced.length).toBe(500);
    expect(r.layout.fixtures).toHaveLength(2000);
  });
});

describe("take guard", () => {
  const bad: [string, unknown][] = [
    ["x 0.5", { sprite: "desk.single", x: 0.5, y: 0, rotation: 0 }],
    ["x null", { sprite: "desk.single", x: null, y: 0, rotation: 0 }],
    ["x string", { sprite: "desk.single", x: "1", y: 0, rotation: 0 }],
    ["x bigint", { sprite: "desk.single", x: 1n, y: 0, rotation: 0 }],
    ["placement undefined", undefined],
  ];
  it.each(bad)("%s never throws and never keeps its place", (_n, p) => {
    const r = resolveLayout(
      room(),
      [seat(1, p as never)],
      [p === undefined ? (undefined as never) : ({ id: id(1001), ...(p as object) } as never)],
    );
    expect(r.saved).toBe(true);
    expect(r.layout.fixtures).toEqual([]);
    const placed = r.layout.seats.concat();
    expect(placed.length + r.unplaced.length).toBe(1);
    for (const s of placed) {
      expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
      expect([s.x, s.y]).toEqual([0, 0]);
    }
  });
});

describe("registry keys", () => {
  it("every registry key is shorter than 129 characters", () => {
    expect(Object.keys(REGISTRY).every((k) => k.length < 129)).toBe(true);
  });
});

describe("catalog lookup", () => {
  const big = catalogFootprints([{ builtinKey: "plant.large", w: 2, h: 2 }], registryFootprints);

  it("a stored fixture overlapping at the catalog size is dropped; at library size both stay", () => {
    const fixtures = [fixture(1, at(0, 4, "plant.large")), fixture(2, at(1, 5, "plant.large"))];
    expect(resolveLayout(room(), [], fixtures).layout.fixtures).toHaveLength(2);
    const r = resolveLayout(room(), [], fixtures, big);
    expect(r.layout.fixtures.map((f) => f.id)).toEqual([id(1001)]);
  });

  it("a seat whose neighbour fixture grew keeps its place (seats first) and the fixture is dropped", () => {
    const r = resolveLayout(
      room(),
      [seat(1, at(2, 0))],
      [fixture(1, at(1, 0, "plant.large"))],
      big,
    );
    expect(r.layout.seats[0]).toMatchObject({ x: 2, y: 0 });
    expect(r.layout.fixtures).toEqual([]);
  });

  it("output always passes checkLayoutRules with the same lookup", () => {
    const fixtures = [
      fixture(1, at(0, 4, "plant.large")),
      fixture(2, at(1, 5, "plant.large")),
      fixture(3, at(11, 7, "plant.large")),
      fixture(4, at(4, 4, "plant.large")),
    ];
    const r = resolveLayout(room(), [seat(1, at(5, 0))], fixtures, big);
    expect(r.layout.fixtures.length).toBeLessThan(fixtures.length);
    expect(checkLayoutRules(r.layout, big)).toEqual({ ok: true });
  });
});
