import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDrawList } from "@/lib/sprites/placement";
import { defaultLayout } from "@/lib/sprites/default-layout";
import type { RoomLayout } from "@/lib/sprites/layout";
import type { SpriteManifest } from "@/lib/sprites/types";
import { checkLayoutRules, registryFootprints, type FootprintLookup } from "@/lib/validate/layout";
import {
  deleteItems,
  draftFromLayout,
  draftToRoomLayout,
  moveItems,
  placeFromTray,
  placeItem,
  resizeRoom,
  rotateItems,
  rulesInput,
  withoutDeskFixtures,
} from "./draft";
import type { Draft, OpResult } from "./types";

const manifest = JSON.parse(
  readFileSync(new URL("../../../public/sprites/office.json", import.meta.url), "utf8"),
) as SpriteManifest;

const room = (p: Partial<RoomLayout> = {}): RoomLayout => ({
  w: 12,
  h: 8,
  floors: [],
  seats: [],
  fixtures: [],
  ...p,
});
const empty = (p: Partial<RoomLayout> = {}, unplaced: { id: string; code: string }[] = []) =>
  draftFromLayout(room(p), unplaced);
const seat = (id: string, x: number, y: number, rotation: 0 | 90 | 180 | 270 = 0) => ({
  id,
  code: `R-${id}`,
  sprite: "desk.single",
  x,
  y,
  rotation,
});
const fx = (sprite: string, x: number, y: number) => ({
  id: "",
  sprite,
  x,
  y,
  rotation: 0 as const,
});

const ok = (r: OpResult): Draft => {
  if (!r.ok) throw new Error(`refused: ${r.code}`);
  return r.draft;
};
const refused = (r: OpResult) => (r.ok ? "ok" : r.code);

describe("draftFromLayout", () => {
  it("draftFromLayout keeps seats with ids and codes, gives fixtures local keys, copies unplaced into the tray", () => {
    const d = empty({ seats: [seat("a", 0, 0)], fixtures: [fx("plant.large", 5, 5)] }, [
      { id: "u", code: "R-u" },
    ]);
    expect(d.items.map((i) => i.key)).toEqual(["s:a", "f:0"]);
    expect(d.items[0]).toMatchObject({ seatId: "a", code: "R-a", kind: "seat" });
    expect(d.items[1]).toMatchObject({ seatId: null, code: null, kind: "fixture" });
    expect(d.tray).toEqual([{ id: "u", code: "R-u" }]);
    expect(d.nextKey).toBe(1);
  });

  it("draftFromLayout of an unsaved default layout (defaultLayout of 0 and 5 seats) is valid", () => {
    for (const n of [0, 5]) {
      const seats = Array.from({ length: n }, (_, i) => ({ id: `s${i}`, code: `R-0${i}` }));
      const d = draftFromLayout(defaultLayout(seats), []);
      expect(d.items).toHaveLength(n);
      expect(checkLayoutRules(rulesInput(d))).toEqual({ ok: true });
    }
  });
});

describe("placeItem", () => {
  it("placeItem adds a fixture / a new desk with seatId null", () => {
    const f = ok(placeItem(empty(), "plant.large", 3, 3));
    expect(f.items).toHaveLength(1);
    expect(f.items[0]).toMatchObject({ kind: "fixture", seatId: null });
    const s = ok(placeItem(f, "desk.single", 0, 0));
    expect(s.items).toHaveLength(2);
    expect(s.items[1]).toMatchObject({ kind: "seat", seatId: null, code: null, rotation: 0 });
    expect(new Set(s.items.map((i) => i.key)).size).toBe(2);
  });

  it("placeItem refuses out of bounds, overlap with a blocking item, desk chair outside the room, chair on a blocker", () => {
    const base = empty({ fixtures: [fx("plant.large", 5, 5)] });
    expect(refused(placeItem(base, "plant.large", 12, 0))).toBe("layout_out_of_bounds");
    expect(refused(placeItem(base, "plant.large", -1, 0))).toBe("layout_out_of_bounds");
    expect(refused(placeItem(base, "plant.large", 5, 5))).toBe("layout_overlap");
    expect(refused(placeItem(base, "desk.single", 11, 0))).toBe("layout_out_of_bounds");
    // chair of a facing-south desk is one row below the desk: row 8 is outside the 8-row room
    expect(refused(placeItem(base, "desk.single", 0, 7))).toBe("layout_out_of_bounds");
    // desk at (4,4) 2x1 has its chair at (4,5): free; desk at (5,4) has its chair on the plant (5,5)
    expect(refused(placeItem(base, "desk.single", 4, 4))).toBe("ok");
    expect(refused(placeItem(base, "desk.single", 5, 4))).toBe("layout_overlap");
    expect(base.items).toHaveLength(1);
  });

  it("placeItem allows a non-blocking fixture over a blocking fixture, but not over a desk", () => {
    const base = empty({ fixtures: [fx("plant.large", 5, 5)] });
    expect(ok(placeItem(base, "prop.mug", 5, 5)).items).toHaveLength(2);
    const desk = empty({ seats: [seat("a", 2, 2)] });
    expect(refused(placeItem(desk, "prop.mug", 3, 2))).toBe("layout_fixture_on_desk");
  });

  it("placeItem refuses an unknown or floor sprite (layout_unknown_sprite)", () => {
    expect(refused(placeItem(empty(), "nope", 0, 0))).toBe("layout_unknown_sprite");
    expect(refused(placeItem(empty(), "floor.wood", 0, 0))).toBe("layout_unknown_sprite");
    expect(refused(placeItem(empty(), "chair.office", 0, 0))).toBe("layout_unknown_sprite");
  });
});

describe("moveItems", () => {
  const d = empty({ seats: [seat("a", 2, 2)], fixtures: [fx("plant.large", 6, 2)] });

  it("moveItems moves a group by (dx, dy); refused as a whole at the room edge; refused on overlap with an unselected item; allowed when selected items swap through each other's old cells", () => {
    const moved = ok(moveItems(d, ["s:a", "f:0"], 1, 2));
    expect(moved.items.map((i) => [i.x, i.y])).toEqual([
      [3, 4],
      [7, 4],
    ]);
    // the plant reaches x 11, the desk would still fit: the whole move is refused
    expect(refused(moveItems(d, ["s:a", "f:0"], 6, 0))).toBe("layout_out_of_bounds");
    expect(refused(moveItems(d, ["s:a", "f:0"], 0, -3))).toBe("layout_out_of_bounds");
    // the desk moved onto the unselected plant
    expect(refused(moveItems(d, ["s:a"], 4, 0))).toBe("layout_overlap");
    // two plants swap: the first moves onto the second's cell while the second moves away
    const two = empty({ fixtures: [fx("plant.large", 0, 0), fx("plant.large", 1, 0)] });
    expect(ok(moveItems(two, ["f:0", "f:1"], 1, 0)).items.map((i) => i.x)).toEqual([1, 2]);
  });
});

describe("rotateItems", () => {
  it("rotateItems cycles desk.single 0→90→180→270→0 and the footprint follows the registry (2×1 ↔ 1×2)", () => {
    let d = empty({ seats: [seat("a", 4, 4)] });
    const seen: number[] = [];
    for (let n = 0; n < 4; n++) {
      d = ok(rotateItems(d, ["s:a"]));
      seen.push(d.items[0].rotation);
    }
    expect(seen).toEqual([90, 180, 270, 0]);
    // 90: 1x2 desk at (4,4) covers (4,4),(4,5): a plant at (4,5) now overlaps, at (5,4) it does not
    const blocked = empty({ seats: [seat("a", 4, 4)], fixtures: [fx("plant.large", 4, 5)] });
    expect(refused(rotateItems(blocked, ["s:a"]))).toBe("layout_overlap");
    const free = empty({ seats: [seat("a", 4, 4)], fixtures: [fx("plant.large", 5, 5)] });
    expect(refused(rotateItems(free, ["s:a"]))).toBe("ok");
  });

  it("rotateItems toggles clock.wall and screen.projector between s and n", () => {
    for (const key of ["clock.wall", "screen.projector"]) {
      let d = empty({ fixtures: [fx(key, 4, 4)] });
      const seen: number[] = [];
      for (let n = 0; n < 3; n++) {
        d = ok(rotateItems(d, ["f:0"]));
        seen.push(d.items[0].rotation);
      }
      expect(seen, key).toEqual([180, 0, 180]);
    }
  });

  it("rotateItems still cycles four directions for bin.trash", () => {
    let d = empty({ fixtures: [fx("bin.trash", 4, 4)] });
    const seen: number[] = [];
    for (let n = 0; n < 4; n++) {
      d = ok(rotateItems(d, ["f:0"]));
      seen.push(d.items[0].rotation);
    }
    expect(seen).toEqual([90, 180, 270, 0]);
  });

  it("rotateItems refuses a rotate that pushes footprint or chair out of bounds; refuses a selection of only non-directional sprites; leaves non-directional items at 0 in a mixed selection", () => {
    // desk at the bottom row: facing east is 1x2 and leaves the room
    expect(refused(rotateItems(empty({ seats: [seat("a", 0, 6)] }), ["s:a"]))).toBe("ok");
    expect(refused(rotateItems(empty({ seats: [seat("a", 0, 7)] }), ["s:a"]))).toBe(
      "layout_out_of_bounds",
    );
    // facing west puts the chair at x-1: out of bounds at x 0
    const west = empty({ seats: [seat("a", 0, 0, 180)] });
    expect(refused(rotateItems(west, ["s:a"]))).toBe("layout_out_of_bounds");
    const plants = empty({ fixtures: [fx("plant.large", 1, 1)] });
    expect(refused(rotateItems(plants, ["f:0"]))).toBe("layout_bad_rotation");
    const mixed = empty({ seats: [seat("a", 4, 4)], fixtures: [fx("plant.large", 1, 1)] });
    const turned = ok(rotateItems(mixed, ["s:a", "f:0"]));
    expect(turned.items.map((i) => i.rotation)).toEqual([90, 0]);
  });
});

describe("deleteItems", () => {
  it("deleteItems drops fixtures and new desks, moves existing seats to removed", () => {
    const base = ok(
      placeItem(
        empty({ seats: [seat("a", 0, 0)], fixtures: [fx("plant.large", 5, 5)] }),
        "desk.single",
        6,
        0,
      ),
    );
    expect(base.items).toHaveLength(3);
    const d = ok(deleteItems(base, ["s:a", "f:0", "n:1"]));
    expect(d.items).toEqual([]);
    expect(d.removed).toEqual([{ id: "a", code: "R-a" }]);
  });
});

describe("placeFromTray", () => {
  it("placeFromTray places a tray seat as desk.single rotation 0 and removes it from the tray; refused on overlap", () => {
    const d = empty({ fixtures: [fx("plant.large", 5, 5)] }, [{ id: "u", code: "R-u" }]);
    expect(refused(placeFromTray(d, "u", 5, 5))).toBe("layout_overlap");
    expect(refused(placeFromTray(d, "zz", 0, 0))).toBe("layout_unknown_sprite");
    const placed = ok(placeFromTray(d, "u", 0, 0));
    expect(placed.tray).toEqual([]);
    expect(placed.items[1]).toMatchObject({
      key: "s:u",
      sprite: "desk.single",
      rotation: 0,
      seatId: "u",
      code: "R-u",
    });
  });
});

describe("resizeRoom", () => {
  it("resizeRoom: 1 and 64 accepted, 0 and 65 refused, shrink cutting an item or chair refused, full-room floor stretched, partial floor clipped, empty zone dropped", () => {
    const d = empty({
      w: 10,
      h: 10,
      floors: [
        { sprite: "floor.wood", x: 0, y: 0, w: 10, h: 10 },
        { sprite: "floor.wood", x: 6, y: 6, w: 4, h: 4 },
        { sprite: "floor.wood", x: 8, y: 0, w: 2, h: 2 },
      ],
      fixtures: [fx("plant.large", 0, 0)],
    });
    expect(refused(resizeRoom(d, 0, 5))).toBe("layout_out_of_bounds");
    expect(refused(resizeRoom(d, 5, 65))).toBe("layout_out_of_bounds");
    expect(refused(resizeRoom(d, 64, 64))).toBe("ok");
    expect(refused(resizeRoom(d, 1, 1))).toBe("ok");
    const small = ok(resizeRoom(d, 7, 7));
    expect(small.floors).toEqual([
      { sprite: "floor.wood", x: 0, y: 0, w: 7, h: 7 },
      { sprite: "floor.wood", x: 6, y: 6, w: 1, h: 1 },
    ]);
    const big = ok(resizeRoom(d, 20, 12));
    expect(big.floors[0]).toMatchObject({ w: 20, h: 12 });
    expect(big.floors[1]).toMatchObject({ x: 6, y: 6, w: 4, h: 4 });
    // a plant at x 9 is cut by width 9; a desk whose chair is on row 3 is cut by height 3
    const cut = empty({ fixtures: [fx("plant.large", 8, 0)] });
    expect(refused(resizeRoom(cut, 8, 8))).toBe("layout_out_of_bounds");
    const chair = empty({ seats: [seat("a", 0, 1)] });
    expect(refused(resizeRoom(chair, 12, 2))).toBe("layout_out_of_bounds");
    expect(refused(resizeRoom(chair, 12, 3))).toBe("ok");
  });
});

describe("draftToRoomLayout", () => {
  it("draftToRoomLayout feeds buildDrawList without unknown keys for desk.single and fixtures (test manifest)", () => {
    let d = empty({ seats: [seat("a", 0, 0)], fixtures: [fx("plant.large", 8, 5)] });
    d = ok(placeItem(d, "desk.single", 4, 4));
    d = ok(placeItem(d, "door", 10, 0));
    const layout = draftToRoomLayout(d);
    expect(layout.seats.map((s) => [s.id, s.code])).toEqual([
      ["a", "R-a"],
      ["n:1", ""],
    ]);
    expect(buildDrawList(layout, {}, manifest).unknown).toEqual([]);
  });
});

describe("fixtures and desks (D61)", () => {
  const mug = (x: number, y: number) => fx("prop.mug", x, y);
  const withMug = () => empty({ seats: [seat("a", 2, 2)], fixtures: [mug(6, 5)] });

  it("moving a fixture onto a desk is refused", () => {
    expect(refused(moveItems(withMug(), ["f:0"], -4, -3))).toBe("layout_fixture_on_desk");
    expect(refused(moveItems(withMug(), ["f:0"], -3, -3))).toBe("layout_fixture_on_desk");
    expect(refused(moveItems(withMug(), ["f:0"], -1, 0))).toBe("ok");
  });

  it("group move onto a desk is refused", () => {
    const d = empty({ seats: [seat("a", 2, 2)], fixtures: [mug(6, 5), mug(8, 5)] });
    expect(refused(moveItems(d, ["f:0", "f:1"], -4, -3))).toBe("layout_fixture_on_desk");
  });

  it("moving a desk onto a prop is refused", () => {
    expect(refused(moveItems(withMug(), ["s:a"], 4, 3))).toBe("layout_fixture_on_desk");
  });

  it("moving a prop and its desk together is allowed", () => {
    const d = empty({ seats: [seat("a", 2, 2)], fixtures: [mug(6, 5)] });
    expect(refused(moveItems(d, ["s:a", "f:0"], 1, 1))).toBe("ok");
  });

  it("rotating a desk onto a prop is refused", () => {
    // desk at (2,2) facing s covers (2,2),(3,2); at 90 it covers (2,2),(2,3)
    const d = empty({ seats: [seat("a", 2, 2)], fixtures: [mug(2, 3)] });
    expect(refused(rotateItems(d, ["s:a"]))).toBe("layout_fixture_on_desk");
  });

  it("placing a tray seat onto a prop is refused", () => {
    const d = empty({ fixtures: [mug(5, 5)] }, [{ id: "u", code: "R-u" }]);
    expect(refused(placeFromTray(d, "u", 5, 5))).toBe("layout_fixture_on_desk");
    expect(refused(placeFromTray(d, "u", 4, 5))).toBe("layout_fixture_on_desk");
    expect(refused(placeFromTray(d, "u", 0, 0))).toBe("ok");
  });

  it("withoutDeskFixtures drops only fixtures on desks and counts them", () => {
    const d = empty({
      seats: [seat("a", 2, 2)],
      fixtures: [mug(2, 2), mug(6, 6), mug(3, 2), fx("plant.large", 9, 5)],
    });
    const r = withoutDeskFixtures(d);
    expect(r.dropped).toBe(2);
    expect(r.draft.items.map((i) => i.key)).toEqual(["s:a", "f:1", "f:3"]);
    expect(checkLayoutRules(rulesInput(r.draft)).ok).toBe(true);
    const clean = empty({ seats: [seat("a", 2, 2)], fixtures: [mug(6, 6)] });
    expect(withoutDeskFixtures(clean)).toEqual({ draft: clean, dropped: 0 });
  });
});

describe("catalog lookup", () => {
  const wide: FootprintLookup = (k) => (k === "prop.mug" ? [3, 1] : registryFootprints(k));
  const d = empty({ fixtures: [{ id: "", sprite: "prop.mug", x: 8, y: 2, rotation: 0 }] });
  const code = (r: OpResult) => (r.ok ? "ok" : r.code);

  it("moveItems, rotateItems and resizeRoom pass the lookup: a widened item at the edge is refused", () => {
    expect(code(moveItems(d, ["f:0"], 1, 0))).toBe("ok");
    expect(code(moveItems(d, ["f:0"], 2, 0, wide))).toBe("layout_out_of_bounds");
    expect(code(resizeRoom(d, 10, 8))).toBe("ok");
    expect(code(resizeRoom(d, 10, 8, wide))).toBe("layout_out_of_bounds");
    expect(code(placeItem(d, "prop.mug", 10, 5))).toBe("ok");
    expect(code(placeItem(d, "prop.mug", 10, 5, 0, wide))).toBe("layout_out_of_bounds");
  });

  it("withoutDeskFixtures uses the lookup", () => {
    const x = empty({
      seats: [seat("a", 2, 2)],
      fixtures: [{ id: "", sprite: "prop.mug", x: 0, y: 2, rotation: 0 }],
    });
    expect(withoutDeskFixtures(x).dropped).toBe(0);
    expect(withoutDeskFixtures(x, wide).dropped).toBe(1);
  });
});
