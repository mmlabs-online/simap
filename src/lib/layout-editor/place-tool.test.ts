import { describe, expect, it } from "vitest";
import { REGISTRY } from "@/lib/sprites/registry";
import {
  LAYOUT_LIMITS,
  footprintOf,
  registryFootprints,
  type FootprintLookup,
} from "@/lib/validate/layout";
import { draftFromLayout } from "./draft";
import { paletteEntries } from "./palette";
import {
  nextTool,
  parseRoomSize,
  parseWhole,
  placementPreview,
  reconcileTool,
  sameTool,
  tryPlace,
  type Tool,
} from "./place-tool";

const unit = paletteEntries().find(
  (e) =>
    e.kind === "fixture" &&
    !e.directional &&
    REGISTRY[e.sprite]?.blocks === true &&
    footprintOf(e.sprite, 0)?.join() === "1,1",
)!.sprite;
const SEAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SEAT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const room = (fixtures: number, w = 64, h = 64) =>
  draftFromLayout(
    {
      w,
      h,
      floors: [],
      seats: [],
      fixtures: Array.from({ length: fixtures }, (_, k) => ({
        id: "",
        sprite: unit,
        x: k % w,
        y: Math.floor(k / w),
        rotation: 0 as const,
      })),
    },
    [
      { id: SEAT_A, code: "Phòng-A-03" },
      { id: SEAT_B, code: "Phòng-A-04" },
    ],
  );

const fx: Tool = { kind: "fixture", sprite: unit };

describe("place tool", () => {
  it("tryPlace fixture: ok returns the draft and key f:<nextKey>; a taken or off-room tile returns the core code; a seat sprite is refused as layout_unknown_sprite", () => {
    const d = room(1, 12, 8);
    const r = tryPlace(d, fx, 5, 5);
    expect(r.ok && r.key).toBe("f:1");
    expect(r.ok && r.draft.items).toHaveLength(2);
    expect(tryPlace(d, fx, 0, 0)).toEqual({ ok: false, code: "layout_overlap" });
    expect(tryPlace(d, fx, 12, 0)).toEqual({ ok: false, code: "layout_out_of_bounds" });
    expect(tryPlace(d, { kind: "fixture", sprite: "desk.single" }, 5, 5)).toEqual({
      ok: false,
      code: "layout_unknown_sprite",
    });
  });

  it("tryPlace refuses fixture_limit at LAYOUT_LIMITS.fixtures, allows at limit − 1", () => {
    const max = LAYOUT_LIMITS.fixtures;
    const last = draftFromLayout(layoutOf(max - 1), []);
    expect(tryPlace(last, fx, 63, 63).ok).toBe(true);
    const full = draftFromLayout(layoutOf(max), []);
    expect(tryPlace(full, fx, 63, 63)).toEqual({ ok: false, code: "fixture_limit" });
  });

  it("tryPlace tray: ok returns key s:<id> and removes the seat from the tray; an id not in the tray is refused", () => {
    const d = room(0, 12, 8);
    const r = tryPlace(d, { kind: "tray", seatId: SEAT_A }, 1, 1);
    expect(r.ok && r.key).toBe(`s:${SEAT_A}`);
    expect(r.ok && r.draft.tray.map((t) => t.id)).toEqual([SEAT_B]);
    expect(tryPlace(d, { kind: "tray", seatId: "nope" }, 1, 1).ok).toBe(false);
  });

  it("placementPreview gives the tile, the footprint size at rotation 0 and ok/refused (incl. fixture_limit), and null without a tool", () => {
    const d = room(1, 12, 8);
    expect(placementPreview(d, fx, { x: 4, y: 4 })).toEqual({ x: 4, y: 4, w: 1, h: 1, ok: true });
    expect(placementPreview(d, fx, { x: 0, y: 0 })?.ok).toBe(false);
    expect(placementPreview(d, null, { x: 4, y: 4 })).toBeNull();
    expect(placementPreview(d, fx, null)).toBeNull();
    const tray = placementPreview(d, { kind: "tray", seatId: SEAT_A }, { x: 3, y: 3 });
    expect(tray?.ok).toBe(true);
    const full = draftFromLayout(layoutOf(LAYOUT_LIMITS.fixtures), []);
    expect(placementPreview(full, fx, { x: 63, y: 63 })?.ok).toBe(false);
  });

  it("nextTool keeps a fixture tool; a tray tool moves to tray[0] or null", () => {
    const d = room(0, 12, 8);
    expect(nextTool(fx, d)).toBe(fx);
    expect(nextTool({ kind: "tray", seatId: SEAT_A }, d)).toEqual({ kind: "tray", seatId: SEAT_A });
    expect(nextTool({ kind: "tray", seatId: SEAT_A }, { ...d, tray: [] })).toBeNull();
  });

  it("tryPlace desk: ok gives key n:<nextKey>, seatId null; refused on a taken tile; seat_limit when seats plus tray reach LAYOUT_LIMITS.seats; a fixture tool with desk.single is still refused", () => {
    const d = room(1, 12, 8);
    const desk: Tool = { kind: "desk" };
    const r = tryPlace(d, desk, 5, 5);
    expect(r.ok && r.key).toBe(`n:${d.nextKey}`);
    const item = r.ok ? r.draft.items.find((i) => i.key === r.key) : undefined;
    expect(item).toMatchObject({ kind: "seat", sprite: "desk.single", seatId: null, code: null });
    expect(tryPlace(d, desk, 0, 0)).toEqual({ ok: false, code: "layout_overlap" });
    const tray = (n: number) =>
      Array.from({ length: n }, (_, k) => ({ id: `t${k}`, code: `R-${k}` }));
    expect(tryPlace({ ...d, tray: tray(LAYOUT_LIMITS.seats - 1) }, desk, 5, 5).ok).toBe(true);
    expect(tryPlace({ ...d, tray: tray(LAYOUT_LIMITS.seats) }, desk, 5, 5)).toEqual({
      ok: false,
      code: "seat_limit",
    });
    expect(tryPlace(d, { kind: "fixture", sprite: "desk.single" }, 5, 5).ok).toBe(false);
  });

  it("placementPreview with a desk tool uses the desk.single footprint; sameTool desk = desk; nextTool keeps a desk tool", () => {
    const d = room(1, 12, 8);
    const desk: Tool = { kind: "desk" };
    const [w, h] = footprintOf("desk.single", 0) ?? [1, 1];
    expect(placementPreview(d, desk, { x: 4, y: 4 })).toEqual({ x: 4, y: 4, w, h, ok: true });
    expect(sameTool(desk, { kind: "desk" })).toBe(true);
    expect(sameTool(desk, fx)).toBe(false);
    expect(sameTool(fx, desk)).toBe(false);
    expect(nextTool(desk, d)).toBe(desk);
  });

  it("reconcileTool clears a tray tool whose seat is not in the tray; keeps fixture tools", () => {
    const d = room(0, 12, 8);
    expect(reconcileTool({ kind: "tray", seatId: "gone" }, d)).toBeNull();
    const t: Tool = { kind: "tray", seatId: SEAT_B };
    expect(reconcileTool(t, d)).toBe(t);
    expect(reconcileTool(fx, d)).toBe(fx);
    expect(reconcileTool(null, d)).toBeNull();
  });

  it("parseWhole accepts '0', ' 12 '; rejects '', '1.5', '-1', '1e2', 'abc'", () => {
    expect(parseWhole("0")).toBe(0);
    expect(parseWhole(" 12 ")).toBe(12);
    for (const bad of ["", "1.5", "-1", "1e2", "abc"]) expect(parseWhole(bad)).toBeNull();
  });

  it("parseRoomSize accepts 1 and 64; rejects 0, 65, empty and non-integers", () => {
    expect(parseRoomSize("1", "64")).toEqual({ ok: true, w: 1, h: 64 });
    for (const [w, h] of [
      ["0", "5"],
      ["5", "65"],
      ["", "5"],
      ["5", "2.5"],
    ]) {
      expect(parseRoomSize(w, h)).toEqual({ ok: false });
    }
  });
});

function layoutOf(n: number) {
  return {
    w: 64,
    h: 64,
    floors: [],
    seats: [],
    fixtures: Array.from({ length: n }, (_, k) => ({
      id: "",
      sprite: unit,
      x: k % 64,
      y: Math.floor(k / 64),
      rotation: 0 as const,
    })),
  };
}

describe("place tool on desks (D61)", () => {
  const mug: Tool = { kind: "fixture", sprite: "prop.mug" };
  const withDesk = () =>
    draftFromLayout(
      {
        w: 12,
        h: 8,
        floors: [],
        seats: [{ id: SEAT_A, code: "R-1", sprite: "desk.single", x: 2, y: 2, rotation: 0 }],
        fixtures: [],
      },
      [],
    );

  it("a fixture on any desk tile is refused (ghost not ok)", () => {
    const d = withDesk();
    for (const x of [2, 3]) {
      expect(tryPlace(d, mug, x, 2)).toEqual({ ok: false, code: "layout_fixture_on_desk" });
      expect(placementPreview(d, mug, { x, y: 2 })?.ok).toBe(false);
    }
    expect(placementPreview(d, mug, { x: 4, y: 2 })?.ok).toBe(true);
  });
});

describe("catalog lookup", () => {
  const wide: FootprintLookup = (k) => (k === unit ? [3, 1] : registryFootprints(k));
  const mug: Tool = { kind: "fixture", sprite: unit };
  const d = draftFromLayout(
    {
      w: 12,
      h: 8,
      floors: [],
      seats: [],
      fixtures: [{ id: "", sprite: unit, x: 5, y: 2, rotation: 0 }],
    },
    [],
  );

  it("the ghost has the catalog size and tryPlace refuses an overlap the registry size would allow", () => {
    expect(placementPreview(d, mug, { x: 3, y: 2 }, wide)).toMatchObject({ w: 3, h: 1, ok: false });
    expect(placementPreview(d, mug, { x: 3, y: 2 })?.ok).toBe(true);
    expect(tryPlace(d, mug, 3, 2, wide).ok).toBe(false);
    expect(tryPlace(d, mug, 3, 2).ok).toBe(true);
  });
});
