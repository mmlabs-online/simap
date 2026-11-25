import { describe, expect, it } from "vitest";
import { deviceTypeKey } from "@/lib/device-types/name";
import { paletteEntries } from "@/lib/layout-editor/palette";
import { REGISTRY } from "@/lib/sprites/registry";
import { checkLayoutRules, footprintOf } from "@/lib/validate/layout";
import { LIBRARY_ITEMS, libraryItem, mapItemName } from "./library";
import { MAP_ITEM_LIMITS } from "./types";

const keys = LIBRARY_ITEMS.map((i) => i.builtinKey);

describe("map item library", () => {
  it("LIBRARY_ITEMS is desk.single, the palette fixtures, the floors, then chair.office (53 rows)", () => {
    expect(LIBRARY_ITEMS).toHaveLength(53);
    expect(new Set(keys).size).toBe(53);
    expect(keys[0]).toBe("desk.single");
    expect(keys.slice(-5)).toEqual([
      "floor.carpet",
      "floor.carpet.alt",
      "floor.lavender",
      "floor.wood",
      "chair.office",
    ]);
    expect(LIBRARY_ITEMS.filter((i) => i.kind === "fixture")).toHaveLength(47);
    expect(Object.isFrozen(LIBRARY_ITEMS)).toBe(true);
  });

  it("the seat and fixture keys equal the keys of paletteEntries()", () => {
    const own = LIBRARY_ITEMS.filter((i) => i.kind === "seat" || i.kind === "fixture").map(
      (i) => i.builtinKey,
    );
    expect(own).toEqual(paletteEntries().map((e) => e.sprite));
  });

  it('name is the key with . and _ as spaces ("wall t s", "window double", "floor carpet alt")', () => {
    expect(libraryItem("wall.t.s")!.name).toBe("wall t s");
    expect(libraryItem("window.double")!.name).toBe("window double");
    expect(libraryItem("floor.carpet.alt")!.name).toBe("floor carpet alt");
    expect(mapItemName("a_b.c")).toBe("a b c");
  });

  it("names are unique under deviceTypeKey and at most 60 chars; groups at most 40", () => {
    expect(new Set(LIBRARY_ITEMS.map((i) => deviceTypeKey(i.name))).size).toBe(53);
    for (const i of LIBRARY_ITEMS) {
      expect(i.name.length).toBeLessThanOrEqual(MAP_ITEM_LIMITS.name);
      expect(i.group.length).toBeGreaterThan(0);
      expect(i.group.length).toBeLessThanOrEqual(MAP_ITEM_LIMITS.group);
    }
  });

  it("size = footprintOf(key, 0) ?? 1x1; n and s frames have the same tiles for every directional item; all sizes 1..4", () => {
    for (const i of LIBRARY_ITEMS) {
      expect([i.w, i.h]).toEqual(footprintOf(i.builtinKey, 0) ?? [1, 1]);
      expect(i.w).toBeGreaterThanOrEqual(MAP_ITEM_LIMITS.sizeMin);
      expect(i.h).toBeLessThanOrEqual(MAP_ITEM_LIMITS.sizeMax);
      if (i.directional) {
        expect(footprintOf(i.builtinKey, 180)).toEqual(footprintOf(i.builtinKey, 0));
      }
    }
    expect([libraryItem("door")!.w, libraryItem("door")!.h]).toEqual([1, 2]);
    expect([libraryItem("table.meeting")!.w, libraryItem("table.meeting")!.h]).toEqual([3, 2]);
    expect(REGISTRY["prop.mug"]!.tiles).toBeNull();
    expect([libraryItem("prop.mug")!.w, libraryItem("prop.mug")!.h]).toEqual([1, 1]);
  });

  it("kind/directional/fixedSize: desk.single seat+fixed, door fixture+directional, floor.wood floor+fixed, chair.office chair+fixed+directional, prop.mug fixture", () => {
    const pick = (k: string) => {
      const i = libraryItem(k)!;
      return [i.kind, i.directional, i.fixedSize];
    };
    expect(pick("desk.single")).toEqual(["seat", true, true]);
    expect(pick("door")).toEqual(["fixture", true, false]);
    expect(pick("floor.wood")).toEqual(["floor", false, true]);
    expect(pick("chair.office")).toEqual(["chair", true, true]);
    expect(pick("prop.mug")).toEqual(["fixture", false, false]);
  });

  it("libraryItem returns null for avatar.body.front, device.pc, desk.pair and unknown keys", () => {
    for (const k of ["avatar.body.front", "device.pc", "desk.pair", "nope", "__proto__"]) {
      expect(libraryItem(k)).toBeNull();
    }
  });

  it("every key the layout validator accepts for a seat or fixture is a LIBRARY_ITEMS key", () => {
    const bases = new Set(
      Object.entries(REGISTRY).map(([k, e]) => (e.dir !== null ? k.slice(0, -2) : k)),
    );
    const known = new Set(keys);
    for (const sprite of bases) {
      const item = { sprite, x: 1, y: 1, rotation: 0 };
      const base = { w: 64, h: 64, floors: [], seats: [], fixtures: [] };
      for (const list of ["seats", "fixtures"] as const) {
        const r = checkLayoutRules({ ...base, [list]: [item] });
        if (r.ok || r.code !== "layout_unknown_sprite") expect(known.has(sprite)).toBe(true);
      }
    }
  });
});
