import { describe, expect, it } from "vitest";
import type { Rotation } from "@/lib/sprites/layout";
import {
  LAYOUT_LIMITS,
  checkLayoutRules,
  floorCellsWithinCap,
  fixturesOnDesks,
  footprintAt,
  footprintOf,
  parseLayoutSave,
  registryFootprints,
  validateLayoutSave,
  type FootprintLookup,
  type LayoutRulesInput,
} from "./layout";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const seat = (n: number, x: number, y: number, rotation = 0, sprite = "desk.single") => ({
  id: id(n),
  sprite,
  x,
  y,
  rotation,
});
const fx = (sprite: string, x: number, y: number, rotation = 0) => ({ sprite, x, y, rotation });

const save = (over: Record<string, unknown> = {}) => ({
  baseVersion: 0,
  w: 12,
  h: 8,
  floors: [{ sprite: "floor.wood", x: 0, y: 0, w: 12, h: 8 }],
  seats: [seat(1, 2, 2)],
  fixtures: [fx("plant.large", 0, 0)],
  ...over,
});

const code = (body: unknown) => {
  const r = validateLayoutSave(body);
  return r.ok ? "ok" : r.code;
};

const rules = (over: Partial<LayoutRulesInput>) =>
  checkLayoutRules({ w: 12, h: 8, floors: [], seats: [], fixtures: [], ...over });

describe("validateLayoutSave", () => {
  describe("shape", () => {
    it("accepts a minimal valid save", () => {
      const r = validateLayoutSave(save());
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.seats[0]).toEqual(seat(1, 2, 2));
    });

    it("refuses non-object, missing field, unknown key at each level", () => {
      for (const body of [null, [], "x", 1]) expect(code(body)).toBe("invalid_request");
      const { floors: _f, ...missing } = save();
      expect(code(missing)).toBe("invalid_request");
      expect(code({ ...save(), extra: 1 })).toBe("invalid_request");
      expect(code(save({ floors: [{ sprite: "floor.wood", x: 0, y: 0, w: 1, h: 1, z: 1 }] }))).toBe(
        "invalid_request",
      );
      expect(code(save({ seats: [{ ...seat(1, 2, 2), extra: 1 }] }))).toBe("invalid_request");
      expect(code(save({ fixtures: [{ ...fx("plant.large", 0, 0), id: id(9) }] }))).toBe(
        "invalid_request",
      );
    });

    it("refuses floats, strings and NaN-like values for x, y, w, h, rotation, baseVersion", () => {
      for (const bad of [1.5, "1", Number.NaN, Infinity, null, -1 / 0]) {
        expect(code(save({ w: bad })), `w ${String(bad)}`).toBe("invalid_request");
        expect(code(save({ h: bad }))).toBe("invalid_request");
        expect(code(save({ baseVersion: bad }))).toBe("invalid_request");
        expect(code(save({ seats: [seat(1, bad as number, 2)] }))).toBe("invalid_request");
        expect(code(save({ seats: [seat(1, 2, bad as number)] }))).toBe("invalid_request");
        expect(code(save({ seats: [seat(1, 2, 2, bad as number)] }))).toBe("invalid_request");
        expect(code(save({ fixtures: [fx("plant.large", bad as number, 0)] }))).toBe(
          "invalid_request",
        );
        expect(code(save({ floors: [{ sprite: "floor.wood", x: 0, y: 0, w: bad, h: 1 }] }))).toBe(
          "invalid_request",
        );
      }
      expect(code(save({ baseVersion: -1 }))).toBe("invalid_request");
    });

    it("refuses non-canonical seat id and duplicate seat id", () => {
      expect(code(save({ seats: [{ ...seat(1, 2, 2), id: "seat-1" }] }))).toBe("invalid_request");
      expect(
        code(save({ seats: [{ ...seat(1, 2, 2), id: "0000000A-0000-4000-8000-000000000001" }] })),
      ).toBe("invalid_request");
      expect(code(save({ seats: [seat(1, 2, 2), seat(1, 6, 2)] }))).toBe("invalid_request");
    });

    it("refuses more than the seat, fixture and floor caps", () => {
      const seats = Array.from({ length: LAYOUT_LIMITS.seats + 1 }, (_, i) => seat(i + 1, 0, 0));
      expect(code(save({ seats }))).toBe("invalid_request");
      const fixtures = Array.from({ length: LAYOUT_LIMITS.fixtures + 1 }, () =>
        fx("prop.mug", 0, 0),
      );
      expect(code(save({ fixtures }))).toBe("invalid_request");
      const floors = Array.from({ length: LAYOUT_LIMITS.floors + 1 }, () => ({
        sprite: "floor.wood",
        x: 0,
        y: 0,
        w: 1,
        h: 1,
      }));
      expect(code(save({ floors }))).toBe("invalid_request");
    });
  });

  describe("sprites", () => {
    it("refuses unknown key and prototype names (constructor, __proto__)", () => {
      for (const sprite of ["nope", "constructor", "__proto__", "toString", ""]) {
        expect(code(save({ fixtures: [fx(sprite, 0, 0)] })), sprite).toBe("layout_unknown_sprite");
      }
    });

    it("refuses a full directional key (desk.single.e, door.e)", () => {
      expect(code(save({ seats: [seat(1, 2, 2, 0, "desk.single.e")] }))).toBe(
        "layout_unknown_sprite",
      );
      expect(code(save({ fixtures: [fx("door.e", 0, 0)] }))).toBe("layout_unknown_sprite");
    });

    it("seats accept only desk.single; desk.pair is refused", () => {
      expect(code(save({ seats: [seat(1, 2, 2, 0, "desk.pair")] }))).toBe("layout_unknown_sprite");
      expect(code(save({ seats: [seat(1, 2, 2, 0, "sofa")] }))).toBe("layout_unknown_sprite");
    });

    it("fixtures refuse desk, chair, floor, device, avatar and state keys", () => {
      for (const sprite of [
        "desk.single",
        "chair.office",
        "floor.wood",
        "device.pc",
        "device.laptop",
        "avatar.body.front",
        "state.cannot",
      ]) {
        expect(code(save({ fixtures: [fx(sprite, 0, 0)] })), sprite).toBe("layout_unknown_sprite");
      }
      expect(code(save({ floors: [{ sprite: "sofa", x: 0, y: 0, w: 1, h: 1 }] }))).toBe(
        "layout_unknown_sprite",
      );
    });

    it("accepts wall.side.e at rotation 0 and refuses the non-key wall.side", () => {
      expect(code(save({ fixtures: [fx("wall.side.e", 5, 5)] }))).toBe("ok");
      expect(code(save({ fixtures: [fx("wall.side", 5, 5)] }))).toBe("layout_unknown_sprite");
    });
  });

  describe("rotation", () => {
    it("refuses 45 and 360", () => {
      expect(code(save({ seats: [seat(1, 2, 2, 45)] }))).toBe("layout_bad_rotation");
      expect(code(save({ fixtures: [fx("door", 5, 5, 360)] }))).toBe("layout_bad_rotation");
      expect(code(save({ fixtures: [fx("door", 5, 5, -90)] }))).toBe("layout_bad_rotation");
    });

    it("accepts all four on directional sprites", () => {
      for (const r of [0, 90, 180, 270]) {
        expect(code(save({ fixtures: [fx("door", 6, 4, r)] })), String(r)).toBe("ok");
        expect(code(save({ seats: [seat(1, 5, 3, r)] })), String(r)).toBe("ok");
      }
    });

    it("refuses 90 on sofa and plant.large, accepts 0", () => {
      for (const s of ["sofa", "plant.large"]) {
        expect(code(save({ fixtures: [fx(s, 6, 4, 90)] })), s).toBe("layout_bad_rotation");
        expect(code(save({ fixtures: [fx(s, 6, 4, 0)] })), s).toBe("ok");
      }
    });
  });

  describe("footprint", () => {
    it("desk.single 0→[2,1], 90→[1,2]; door 0→[1,2], 90→[2,1]; table.meeting 0→[3,2], 90→[2,3]; prop.mug→[1,1]", () => {
      expect(footprintOf("desk.single", 0)).toEqual([2, 1]);
      expect(footprintOf("desk.single", 90)).toEqual([1, 2]);
      expect(footprintOf("door", 0)).toEqual([1, 2]);
      expect(footprintOf("door", 90)).toEqual([2, 1]);
      expect(footprintOf("table.meeting", 0)).toEqual([3, 2]);
      expect(footprintOf("table.meeting", 90)).toEqual([2, 3]);
      expect(footprintOf("prop.mug", 0)).toEqual([1, 1]);
      expect(footprintOf("nope", 0)).toBeNull();
    });
  });

  describe("bounds", () => {
    it("refuses negative, right-edge and bottom-edge overflow using the rotated footprint", () => {
      expect(rules({ fixtures: [fx("plant.large", -1, 0)] })).toMatchObject({
        code: "layout_out_of_bounds",
      });
      // desk.single at rotation 0 is 2 wide: x = 10 fits in 12, x = 11 does not.
      expect(rules({ seats: [seat(1, 10, 3)] }).ok).toBe(true);
      expect(rules({ seats: [seat(1, 11, 3)] })).toMatchObject({ code: "layout_out_of_bounds" });
      // rotated 90 it is 2 tall: y = 5 leaves the chair at y = 7 (in), y = 6 puts the chair at 8 (out).
      expect(rules({ seats: [seat(1, 3, 5, 90)] }).ok).toBe(true);
      expect(rules({ seats: [seat(1, 3, 7, 90)] })).toMatchObject({ code: "layout_out_of_bounds" });
      expect(rules({ fixtures: [fx("door", 3, 7, 0)] })).toMatchObject({
        code: "layout_out_of_bounds",
      });
      expect(rules({ fixtures: [fx("door", 3, 6, 0)] }).ok).toBe(true);
    });

    it("refuses grid 0 and 65, accepts 1 and 64", () => {
      expect(rules({ w: 0 })).toMatchObject({ code: "layout_out_of_bounds" });
      expect(rules({ h: 0 })).toMatchObject({ code: "layout_out_of_bounds" });
      expect(rules({ w: 65 })).toMatchObject({ code: "layout_out_of_bounds" });
      expect(rules({ h: 65 })).toMatchObject({ code: "layout_out_of_bounds" });
      expect(rules({ w: 1, h: 1 }).ok).toBe(true);
      expect(rules({ w: 64, h: 64 }).ok).toBe(true);
    });

    it("refuses a floor zone outside the grid; accepts overlapping zones", () => {
      const zone = (x: number, y: number, w: number, h: number) => ({
        sprite: "floor.wood",
        x,
        y,
        w,
        h,
      });
      expect(rules({ floors: [zone(0, 0, 13, 8)] })).toMatchObject({
        code: "layout_out_of_bounds",
      });
      expect(rules({ floors: [zone(-1, 0, 2, 2)] })).toMatchObject({
        code: "layout_out_of_bounds",
      });
      expect(rules({ floors: [zone(0, 0, 0, 2)] })).toMatchObject({ code: "layout_out_of_bounds" });
      expect(rules({ floors: [zone(0, 0, 12, 8), zone(2, 2, 4, 4)] }).ok).toBe(true);
    });
  });

  describe("overlap", () => {
    it("refuses desk on desk, desk on wall, door on wall, rotated-footprint overlap", () => {
      expect(rules({ seats: [seat(1, 2, 2), seat(2, 3, 2)] })).toMatchObject({
        code: "layout_overlap",
      });
      expect(rules({ seats: [seat(1, 2, 2)], fixtures: [fx("wall.top", 3, 2)] })).toMatchObject({
        code: "layout_overlap",
      });
      expect(rules({ fixtures: [fx("wall.top", 3, 2), fx("door", 3, 1)] })).toMatchObject({
        code: "layout_overlap",
      });
      // desk at 90 covers (2,2) and (2,3); a plant on (2,3) collides, which a 2x1 footprint would miss.
      expect(
        rules({ seats: [seat(1, 2, 2, 90)], fixtures: [fx("plant.large", 2, 3)] }),
      ).toMatchObject({ code: "layout_overlap" });
    });

    it("accepts label.sign twice on a free tile", () => {
      expect(rules({ fixtures: [fx("label.sign", 4, 4), fx("label.sign", 4, 4)] }).ok).toBe(true);
    });
  });

  describe("fixture on a desk", () => {
    const desk = (rotation = 0) => seat(1, 2, 2, rotation);

    it("prop.mug on either tile of an s desk gives layout_fixture_on_desk", () => {
      for (const x of [2, 3]) {
        expect(rules({ seats: [desk()], fixtures: [fx("prop.mug", x, 2)] })).toEqual({
          ok: false,
          code: "layout_fixture_on_desk",
        });
      }
    });

    it("prop on the second tile of an e (1x2) desk gives layout_fixture_on_desk", () => {
      expect(rules({ seats: [desk(90)], fixtures: [fx("prop.mug", 2, 3)] })).toMatchObject({
        code: "layout_fixture_on_desk",
      });
    });

    it("a prop next to a desk, and on its chair tile, is allowed", () => {
      expect(rules({ seats: [desk()], fixtures: [fx("prop.mug", 4, 2)] }).ok).toBe(true);
      expect(rules({ seats: [desk()], fixtures: [fx("prop.mug", 2, 3)] }).ok).toBe(true);
      expect(rules({ seats: [desk(90)], fixtures: [fx("prop.mug", 3, 3)] }).ok).toBe(true);
    });

    it("a blocking plant on a desk is still layout_overlap (rule order)", () => {
      expect(rules({ seats: [desk()], fixtures: [fx("plant.large", 2, 2)] })).toMatchObject({
        code: "layout_overlap",
      });
    });

    it("validateLayoutSave with a prop on a desk returns layout_fixture_on_desk", () => {
      expect(code(save({ fixtures: [fx("prop.mug", 2, 2)] }))).toBe("layout_fixture_on_desk");
    });

    it("fixturesOnDesks returns exactly the offending fixture indices", () => {
      const input = {
        w: 12,
        h: 8,
        floors: [],
        seats: [desk()],
        fixtures: [
          fx("prop.mug", 0, 0),
          fx("prop.mug", 3, 2),
          fx("label.sign", 4, 4),
          fx("prop.mug", 2, 2),
        ],
      };
      expect(fixturesOnDesks(input)).toEqual([1, 3]);
      expect(fixturesOnDesks({ ...input, fixtures: [] })).toEqual([]);
    });
  });

  describe("chair", () => {
    it("refuses a chair outside the room for each of the 4 directions", () => {
      const cases: [number, number, number, Rotation][] = [
        [2, 7, 0, 0], // facing s: chair below the bottom edge
        [2, 0, 0, 180], // facing n: chair above the top edge
        [11, 3, 90, 90], // facing e: chair beyond the right edge
        [0, 3, 90, 270], // facing w: chair left of the left edge
      ];
      for (const [x, y, , rotation] of cases) {
        expect(rules({ seats: [seat(1, x, y, rotation)] }), `${rotation}`).toMatchObject({
          code: "layout_out_of_bounds",
        });
      }
    });

    it("refuses a chair on a wall and two seats sharing a chair tile", () => {
      // seat at (2,2) rotation 0 has its chair at (2,3).
      expect(rules({ seats: [seat(1, 2, 2)], fixtures: [fx("wall.top", 2, 3)] })).toMatchObject({
        code: "layout_overlap",
      });
      // a second desk facing north at (2,4) has its chair at (2,3) too.
      expect(rules({ seats: [seat(1, 2, 2), seat(2, 2, 4, 180)] })).toMatchObject({
        code: "layout_overlap",
      });
    });

    it("accepts a prop on a chair tile", () => {
      expect(rules({ seats: [seat(1, 2, 2)], fixtures: [fx("prop.mug", 2, 3)] }).ok).toBe(true);
    });
  });
});

describe("floorCellsWithinCap", () => {
  const zone = (w: number, h: number) => ({ sprite: "floor.wood", x: 0, y: 0, w, h });

  it("accepts exactly twice the grid area", () => {
    expect(floorCellsWithinCap([zone(12, 8), zone(12, 8)], 12, 8)).toBe(true);
  });

  it("refuses one cell above twice the grid area", () => {
    expect(floorCellsWithinCap([zone(12, 8), zone(12, 8), zone(1, 1)], 12, 8)).toBe(false);
  });

  it("refuses 64 full-grid zones", () => {
    expect(
      floorCellsWithinCap(
        Array.from({ length: 64 }, () => zone(64, 64)),
        64,
        64,
      ),
    ).toBe(false);
  });

  it("accepts one full-grid zone", () => {
    expect(floorCellsWithinCap([zone(12, 8)], 12, 8)).toBe(true);
  });
});

describe("validateLayoutSave floor and version caps", () => {
  const zone = (w: number, h: number, x = 0, y = 0) => ({ sprite: "floor.wood", x, y, w, h });
  const field = (body: unknown) => {
    const r = validateLayoutSave(body);
    return r.ok ? "ok" : "field" in r ? `${r.code}:${r.field}` : r.code;
  };

  it("accepts baseVersion 2147483647, refuses 2147483648", () => {
    expect(field(save({ baseVersion: 2_147_483_647 }))).toBe("ok");
    expect(field(save({ baseVersion: 2_147_483_648 }))).toBe("invalid_request:baseVersion");
  });

  it("refuses 64 full-grid zones on a 64 x 64 grid with invalid_request, field floors", () => {
    const floors = Array.from({ length: 64 }, () => zone(64, 64));
    expect(field(save({ w: 64, h: 64, floors, seats: [], fixtures: [] }))).toBe(
      "invalid_request:floors",
    );
  });

  it("accepts exactly twice the grid area, refuses one cell more", () => {
    const twice = [zone(12, 8), zone(12, 8)];
    expect(field(save({ floors: twice, seats: [], fixtures: [] }))).toBe("ok");
    const more = [...twice, zone(1, 1)];
    expect(field(save({ floors: more, seats: [], fixtures: [] }))).toBe("invalid_request:floors");
  });

  it("an out-of-bounds zone over the cap still returns layout_out_of_bounds", () => {
    const floors = [...Array.from({ length: 10 }, () => zone(12, 8)), zone(13, 8)];
    expect(field(save({ floors, seats: [], fixtures: [] }))).toBe("layout_out_of_bounds");
  });
});

describe("footprint lookup", () => {
  const lookup =
    (sizes: Record<string, [number, number]>): FootprintLookup =>
    (k) =>
      sizes[k] ?? null;

  it("footprintAt swaps a 3x1 lookup at 90 and 270, not at 0 and 180; null when the rotation has no frame or the lookup has no entry", () => {
    const l = lookup({ "table.meeting": [3, 1], door: [3, 1] });
    expect(footprintAt("table.meeting", 0, l)).toEqual([3, 1]);
    expect(footprintAt("door", 90, l)).toEqual([1, 3]);
    expect(footprintAt("door", 270, l)).toEqual([1, 3]);
    expect(footprintAt("door", 180, l)).toEqual([3, 1]);
    expect(footprintAt("nope", 0, l)).toBeNull();
    expect(footprintAt("plant.large", 0, l)).toBeNull();
  });

  it("sized rules: plant.large at 2x2 turns two diagonal plants into layout_overlap", () => {
    const fixtures = [fx("plant.large", 0, 0), fx("plant.large", 1, 1)];
    expect(rules({ fixtures }).ok).toBe(true);
    const big = lookup({ "plant.large": [2, 2] });
    expect(checkLayoutRules({ w: 12, h: 8, floors: [], seats: [], fixtures }, big)).toEqual({
      ok: false,
      code: "layout_overlap",
    });
  });

  it("sized rules: table.meeting at 4x1 rotated 90 near the bottom edge gives layout_out_of_bounds; at the registry size it passes", () => {
    const fixtures = [fx("table.meeting", 0, 5, 90)];
    const l = lookup({ "table.meeting": [4, 1] });
    expect(checkLayoutRules({ w: 12, h: 8, floors: [], seats: [], fixtures }, l)).toEqual({
      ok: false,
      code: "layout_out_of_bounds",
    });
    expect(rules({ fixtures: [fx("table.meeting", 0, 5)] }).ok).toBe(true);
  });

  it("sized rules: prop.mug at 2x1 left of a desk gives layout_fixture_on_desk; fixturesOnDesks with the lookup returns its index", () => {
    const seats = [seat(1, 4, 4)];
    const fixtures = [fx("prop.mug", 3, 4)];
    const l = lookup({ "prop.mug": [2, 1], "desk.single": [2, 1] });
    expect(rules({ seats, fixtures }).ok).toBe(true);
    expect(fixturesOnDesks({ w: 12, h: 8, floors: [], seats, fixtures }, l)).toEqual([0]);
    expect(checkLayoutRules({ w: 12, h: 8, floors: [], seats, fixtures }, l)).toEqual({
      ok: false,
      code: "layout_fixture_on_desk",
    });
  });

  it("sized rules: a shrunk table.meeting (1x1) in the last column passes with the lookup and fails with the registry", () => {
    const fixtures = [fx("table.meeting", 11, 0)];
    const l = lookup({ "table.meeting": [1, 1] });
    expect(checkLayoutRules({ w: 12, h: 8, floors: [], seats: [], fixtures }, l).ok).toBe(true);
    expect(rules({ fixtures })).toEqual({ ok: false, code: "layout_out_of_bounds" });
  });

  it("a lookup returning null for a placed key gives layout_unknown_sprite", () => {
    const r = checkLayoutRules(
      { w: 12, h: 8, floors: [], seats: [], fixtures: [fx("plant.large", 0, 0)] },
      () => null,
    );
    expect(r).toEqual({ ok: false, code: "layout_unknown_sprite" });
  });

  it("registryFootprints gives the registry size at rotation 0, null for an unknown key", () => {
    expect(registryFootprints("table.meeting")).toEqual([3, 2]);
    expect(registryFootprints("nope")).toBeNull();
  });
});

describe("parseLayoutSave", () => {
  const parse = (body: unknown) => {
    const r = parseLayoutSave(body);
    return r.ok ? "ok" : r.code;
  };

  it("accepts an overlap, an item out of bounds and a fixture on a desk", () => {
    expect(parse(save({ fixtures: [fx("table.meeting", 0, 0), fx("table.meeting", 1, 0)] }))).toBe(
      "ok",
    );
    expect(parse(save({ fixtures: [fx("table.meeting", 11, 7)] }))).toBe("ok");
    expect(parse(save({ fixtures: [fx("prop.mug", 2, 2)] }))).toBe("ok");
  });

  it("still refuses shape (400), unknown sprite, bad rotation, zone out of bounds, grid 65 (422) and the floor cap (400 floors)", () => {
    expect(parse(null)).toBe("invalid_request");
    expect(parse(save({ fixtures: [fx("nope", 0, 0)] }))).toBe("layout_unknown_sprite");
    expect(parse(save({ fixtures: [fx("plant.large", 0, 0, 45)] }))).toBe("layout_bad_rotation");
    expect(parse(save({ floors: [{ sprite: "floor.wood", x: 0, y: 0, w: 13, h: 8 }] }))).toBe(
      "layout_out_of_bounds",
    );
    expect(parse(save({ w: 65 }))).toBe("layout_out_of_bounds");
    const full = { sprite: "floor.wood", x: 0, y: 0, w: 12, h: 8 };
    expect(parse(save({ floors: Array.from({ length: 3 }, () => full) }))).toBe("invalid_request");
  });

  it("validateLayoutSave without a lookup returns what it returned before", () => {
    expect(code(save({ fixtures: [fx("table.meeting", 11, 7)] }))).toBe("layout_out_of_bounds");
    expect(code(save({ fixtures: [fx("prop.mug", 2, 2)] }))).toBe("layout_fixture_on_desk");
    expect(code(save({ fixtures: [fx("plant.large", 0, 0), fx("plant.large", 0, 0)] }))).toBe(
      "layout_overlap",
    );
    expect(code(save())).toBe("ok");
  });
});

describe("SIM-042 built-in items", () => {
  const NEW_KEYS = [
    "bin.trash",
    "chart.flip",
    "clock.wall",
    "cooler.water",
    "lamp.desk",
    "screen.projector",
  ];

  it("bin.trash, chart.flip, cooler.water, lamp.desk accept 0/90/180/270", () => {
    for (const key of ["bin.trash", "chart.flip", "cooler.water", "lamp.desk"]) {
      for (const rotation of [0, 90, 180, 270]) {
        expect(rules({ fixtures: [fx(key, 4, 4, rotation)] }), `${key} ${rotation}`).toEqual({
          ok: true,
        });
      }
    }
  });

  it("n/s-only items refuse 90 and 270 with layout_bad_rotation, accept 0 and 180", () => {
    for (const key of ["clock.wall", "screen.projector"]) {
      for (const rotation of [0, 180]) {
        expect(rules({ fixtures: [fx(key, 4, 4, rotation)] }), `${key} ${rotation}`).toEqual({
          ok: true,
        });
      }
      for (const rotation of [90, 270]) {
        expect(rules({ fixtures: [fx(key, 4, 4, rotation)] }), `${key} ${rotation}`).toEqual({
          ok: false,
          code: "layout_bad_rotation",
        });
      }
    }
    // a mixed layout is refused whole
    expect(rules({ fixtures: [fx("clock.wall", 1, 1, 180), fx("clock.wall", 5, 5, 90)] })).toEqual({
      ok: false,
      code: "layout_bad_rotation",
    });
  });

  it("screen.projector is 2x1 at 0/180 and 1x2 at 90/270; the others are 1x1", () => {
    const at = (k: string, r: Rotation) => footprintAt(k, r, registryFootprints);
    expect([0, 180].map((r) => at("screen.projector", r as Rotation))).toEqual([
      [2, 1],
      [2, 1],
    ]);
    expect([90, 270].map((r) => at("screen.projector", r as Rotation))).toEqual([
      [1, 2],
      [1, 2],
    ]);
    for (const key of NEW_KEYS.filter((k) => k !== "screen.projector")) {
      expect(at(key, 0), key).toEqual([1, 1]);
    }
  });

  it("clock.wall and screen.projector on wall.face cells give no overlap; cooler.water on one does", () => {
    const wall = [fx("wall.face", 3, 3), fx("wall.face", 4, 3)];
    expect(rules({ fixtures: [...wall, fx("clock.wall", 3, 3)] }).ok).toBe(true);
    expect(rules({ fixtures: [...wall, fx("screen.projector", 3, 3)] }).ok).toBe(true);
    expect(rules({ fixtures: [...wall, fx("cooler.water", 3, 3)] })).toEqual({
      ok: false,
      code: "layout_overlap",
    });
  });

  it("lamp.desk beside a desk saves; on a desk tile gives layout_fixture_on_desk", () => {
    const desk = seat(1, 2, 2);
    expect(rules({ seats: [desk], fixtures: [fx("lamp.desk", 4, 2)] }).ok).toBe(true);
    expect(rules({ seats: [desk], fixtures: [fx("lamp.desk", 2, 2)] })).toEqual({
      ok: false,
      code: "layout_fixture_on_desk",
    });
  });
});
