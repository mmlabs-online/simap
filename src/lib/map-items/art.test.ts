import { describe, expect, it } from "vitest";
import { artDirAllowed, mapItemImageFits, sizeFor, spriteAllowedFor, spriteFits } from "./art";
import { libraryItem } from "./library";

const item = (k: string) => libraryItem(k)!;

describe("map item art rules", () => {
  it("sizeFor: n/s give [w,h], e/w give [h,w]", () => {
    expect(sizeFor("n", 2, 1)).toEqual([2, 1]);
    expect(sizeFor("s", 2, 1)).toEqual([2, 1]);
    expect(sizeFor("e", 2, 1)).toEqual([1, 2]);
    expect(sizeFor("w", 2, 1)).toEqual([1, 2]);
  });

  it("artDirAllowed: directional item all four; non-directional only s", () => {
    for (const d of ["n", "e", "s", "w"] as const) {
      expect(artDirAllowed(item("door"), d)).toBe(true);
    }
    expect(artDirAllowed(item("plant.large"), "s")).toBe(true);
    for (const d of ["n", "e", "w"] as const) {
      expect(artDirAllowed(item("plant.large"), d)).toBe(false);
    }
  });

  it("spriteFits: door.e fits door 1x2 at e; table.meeting.n does not fit a 2x2 item at n; prop.mug (tiles null) fits 1x1", () => {
    expect(spriteFits("door.e", "e", 1, 2)).toBe(true);
    expect(spriteFits("door.e", "s", 1, 2)).toBe(false);
    expect(spriteFits("table.meeting.n", "n", 2, 2)).toBe(false);
    expect(spriteFits("table.meeting.n", "n", 3, 2)).toBe(true);
    expect(spriteFits("prop.mug", "s", 1, 1)).toBe(true);
  });

  it("spriteAllowedFor: plant.small ok for plant.large; floor.wood ok for floor.carpet, refused for plant.large; plant.large refused for floor.carpet; avatar/device/state frames refused for every item", () => {
    expect(spriteAllowedFor(item("plant.large"), "plant.small")).toBe(true);
    expect(spriteAllowedFor(item("floor.carpet"), "floor.wood")).toBe(true);
    expect(spriteAllowedFor(item("plant.large"), "floor.wood")).toBe(false);
    expect(spriteAllowedFor(item("floor.carpet"), "plant.large")).toBe(false);
    expect(spriteAllowedFor(item("plant.large"), "avatar.body.back")).toBe(false);
    expect(spriteAllowedFor(item("plant.large"), "device.laptop.e")).toBe(false);
    expect(spriteAllowedFor(item("door"), "avatar.body.back")).toBe(false);
    expect(spriteAllowedFor(item("plant.large"), "no.such.frame")).toBe(false);
  });
});

describe("mapItemImageFits", () => {
  const px = (width: number, height: number) => ({ width, height });
  const floor = { kind: "floor" } as const;
  const fixture = { kind: "fixture" } as const;

  it("floor 32x32 ok; floor 32x64, 64x64, 32x31 refused", () => {
    expect(mapItemImageFits(floor, "s", 1, 1, px(32, 32))).toBe(true);
    for (const [w, h] of [
      [32, 64],
      [64, 64],
      [32, 31],
    ] as const) {
      expect(mapItemImageFits(floor, "s", 1, 1, px(w, h))).toBe(false);
    }
  });

  it("1x1 fixture: 32x32 and 32x64 ok; 32x65, 32x31, 33x32 refused", () => {
    expect(mapItemImageFits(fixture, "s", 1, 1, px(32, 32))).toBe(true);
    expect(mapItemImageFits(fixture, "s", 1, 1, px(32, 64))).toBe(true);
    expect(mapItemImageFits(fixture, "s", 1, 1, px(32, 65))).toBe(false);
    expect(mapItemImageFits(fixture, "s", 1, 1, px(32, 31))).toBe(false);
    expect(mapItemImageFits(fixture, "s", 1, 1, px(33, 32))).toBe(false);
  });

  it("2x1 item: s/n 64x32 and 64x64 ok, 64x65 refused, 32x32 refused (width)", () => {
    for (const d of ["s", "n"] as const) {
      expect(mapItemImageFits(fixture, d, 2, 1, px(64, 32))).toBe(true);
      expect(mapItemImageFits(fixture, d, 2, 1, px(64, 64))).toBe(true);
      expect(mapItemImageFits(fixture, d, 2, 1, px(64, 65))).toBe(false);
      expect(mapItemImageFits(fixture, d, 2, 1, px(32, 32))).toBe(false);
    }
  });

  it("2x1 item e/w uses swapped tiles: 32x64 and 32x96 ok, 64x32 refused", () => {
    for (const d of ["e", "w"] as const) {
      expect(mapItemImageFits(fixture, d, 2, 1, px(32, 64))).toBe(true);
      expect(mapItemImageFits(fixture, d, 2, 1, px(32, 96))).toBe(true);
      expect(mapItemImageFits(fixture, d, 2, 1, px(64, 32))).toBe(false);
    }
  });

  it("4x4 item: 128x128 and 128x160 ok, 128x161 refused", () => {
    expect(mapItemImageFits(fixture, "s", 4, 4, px(128, 128))).toBe(true);
    expect(mapItemImageFits(fixture, "s", 4, 4, px(128, 160))).toBe(true);
    expect(mapItemImageFits(fixture, "s", 4, 4, px(128, 161))).toBe(false);
  });

  it("desk (seat) and chair follow the fixture rule (overhang allowed)", () => {
    for (const k of ["desk.single", "chair.office"]) {
      const it = item(k);
      expect(mapItemImageFits(it, "s", it.w, it.h, px(32 * it.w, 32 * it.h + 32))).toBe(true);
      expect(mapItemImageFits(it, "s", it.w, it.h, px(32 * it.w, 32 * it.h + 33))).toBe(false);
    }
  });
});
