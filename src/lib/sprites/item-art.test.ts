import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { libraryItem } from "@/lib/map-items/library";
import {
  imageFits,
  itemArtDir,
  itemBox,
  itemImageId,
  parseItemImageId,
  placedArtEntries,
  resolveItemArt,
} from "./item-art";
import type { LayoutItem, RoomLayout } from "./layout";
import { ROTATION_TO_DIR, chairFor } from "./placement";
import type { SpriteManifest } from "./types";

const manifest = JSON.parse(
  readFileSync(new URL("../../../public/sprites/office.json", import.meta.url), "utf8"),
) as SpriteManifest;

const blank = { sprite: null, hasImage: false, imageVersion: 0 };
const rowOf = (key: string, art: Partial<LayoutItem["art"]> = {}): LayoutItem => {
  const lib = libraryItem(key)!;
  return {
    builtinKey: key,
    name: lib.name,
    group: lib.group,
    w: lib.w,
    h: lib.h,
    kind: lib.kind,
    directional: lib.directional,
    fixedSize: lib.fixedSize,
    art: { n: blank, e: blank, s: blank, w: blank, ...art },
  };
};
const png = (version = 1) => ({ sprite: null, hasImage: true, imageVersion: version });

describe("direction and box", () => {
  it("itemArtDir: directional uses ROTATION_TO_DIR; non-directional and floor use s", () => {
    const desk = rowOf("desk.single");
    for (const r of [0, 90, 180, 270] as const) {
      expect(itemArtDir(desk, r)).toBe(ROTATION_TO_DIR[r]);
      expect(itemArtDir(rowOf("plant.large"), r)).toBe("s");
      expect(itemArtDir(rowOf("floor.wood"), r)).toBe("s");
    }
  });

  it("itemBox swaps w and h at 90/270", () => {
    const row = rowOf("table.meeting");
    expect([row.w, row.h]).toEqual([3, 2]);
    expect(itemBox(row, 0)).toEqual([3, 2]);
    expect(itemBox(row, 90)).toEqual([2, 3]);
    expect(itemBox(row, 180)).toEqual([3, 2]);
    expect(itemBox(row, 270)).toEqual([2, 3]);
  });

  it("imageFits: width exact, height up to 32 px taller, floors exactly 32 x 32", () => {
    const fx = rowOf("plant.large");
    expect(imageFits(fx, [1, 1], { w: 32, h: 32 })).toBe(true);
    expect(imageFits(fx, [1, 1], { w: 32, h: 64 })).toBe(true);
    expect(imageFits(fx, [1, 1], { w: 32, h: 65 })).toBe(false);
    expect(imageFits(fx, [1, 1], { w: 32, h: 31 })).toBe(false);
    expect(imageFits(fx, [1, 1], { w: 64, h: 32 })).toBe(false);
    const floor = rowOf("floor.wood");
    expect(imageFits(floor, [1, 1], { w: 32, h: 32 })).toBe(true);
    expect(imageFits(floor, [1, 1], { w: 32, h: 48 })).toBe(false);
  });
});

describe("resolveItemArt", () => {
  const run = (
    row: LayoutItem,
    size: { w: number; h: number } | null,
    frames = manifest.frames,
    dir: "n" | "e" | "s" | "w" = "s",
  ) => {
    const unknown: string[] = [];
    const art = resolveItemArt({
      item: row,
      dir,
      box: [1, 1],
      libraryKey: "plant.large",
      frames,
      image: () => size,
      unknown,
    });
    return { art, unknown };
  };

  it("a ready image that fits wins", () => {
    const row = rowOf("plant.large", {
      s: { sprite: "plant.small", hasImage: true, imageVersion: 3 },
    });
    expect(run(row, { w: 32, h: 48 }).art).toEqual({
      type: "image",
      src: "item:plant.large|s",
      version: 3,
      w: 32,
      h: 48,
    });
  });

  it("image not ready falls to the package sprite, then the library frame, then the placeholder", () => {
    const withSprite = rowOf("plant.large", {
      s: { sprite: "plant.small", hasImage: true, imageVersion: 1 },
    });
    expect(run(withSprite, null).art).toEqual({
      type: "frame",
      key: "plant.small",
      library: false,
    });
    const noFrame = { ...manifest.frames };
    delete noFrame["plant.small"];
    const missing = run(withSprite, null, noFrame);
    expect(missing.art).toEqual({ type: "frame", key: "plant.large", library: true });
    expect(missing.unknown).toEqual(["plant.small"]);
    delete noFrame["plant.large"];
    const none = run(withSprite, null, noFrame);
    expect(none.art).toEqual({ type: "placeholder" });
    expect(none.unknown).toEqual(["plant.small", "plant.large"]);
  });

  it("a decoded size that does not fit counts as failed", () => {
    const row = rowOf("plant.large", { s: png() });
    for (const size of [
      { w: 31, h: 32 },
      { w: 32, h: 80 },
      { w: 32, h: 16 },
    ]) {
      expect(run(row, size).art).toEqual({ type: "frame", key: "plant.large", library: true });
    }
  });
});

describe("placedArtEntries", () => {
  const layout = (p: Partial<RoomLayout>): RoomLayout => ({
    w: 10,
    h: 10,
    floors: [],
    seats: [],
    fixtures: [],
    ...p,
  });
  const at = (id: string, sprite: string, rotation: 0 | 90 | 180 | 270 = 0) => ({
    id,
    sprite,
    x: 1,
    y: 1,
    rotation,
  });

  it("is empty for an empty layout", () => {
    expect(placedArtEntries(layout({}), [rowOf("plant.large", { s: png() })])).toEqual([]);
  });

  it("lists placed directions that have an image, deduplicated", () => {
    const items = [
      rowOf("plant.large", { s: png(2) }),
      rowOf("floor.wood", { s: png(5) }),
      rowOf("desk.single", { e: png(7) }),
      rowOf("cabinet.filing", { s: png() }),
    ];
    const entries = placedArtEntries(
      layout({
        floors: [{ sprite: "floor.wood", x: 0, y: 0, w: 2, h: 2 }],
        fixtures: [at("a", "plant.large"), at("b", "plant.large"), at("c", "unknown.thing")],
        seats: [
          { ...at("s", "desk.single", 90), code: "A1" },
          { ...at("t", "desk.single"), code: "A2" },
        ],
      }),
      items,
    );
    expect(entries.map((e) => [e.id, e.imageVersion]).sort()).toEqual([
      ["item:desk.single|e", 7],
      ["item:floor.wood|s", 5],
      ["item:plant.large|s", 2],
    ]);
  });

  it("the implied chair uses chair.office at the chair's direction", () => {
    for (const r of [0, 90, 180, 270] as const) {
      const dir = ROTATION_TO_DIR[r];
      const suffix = chairFor({ x: 0, y: 0 }, [2, 1], dir).key.slice(-1) as "n" | "e" | "s" | "w";
      const items = [rowOf("chair.office", { [suffix]: png() })];
      const entries = placedArtEntries(
        layout({ seats: [{ ...at("s", "desk.single", r), code: "A1" }] }),
        items,
      );
      expect(entries.map((e) => e.id)).toEqual([itemImageId("chair.office", suffix)]);
    }
  });
});

describe("image ids", () => {
  it("round-trips key and direction; a uuid is not an item id", () => {
    expect(parseItemImageId(itemImageId("table.meeting", "w"))).toEqual({
      key: "table.meeting",
      dir: "w",
    });
    expect(parseItemImageId("0b6a1e55-2d6b-4a77-9d5b-7c1b3f0e2a11")).toBeNull();
    expect(parseItemImageId("item:x|q")).toBeNull();
  });
});
