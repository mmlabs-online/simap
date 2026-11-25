import { describe, expect, it } from "vitest";
import { artDirAllowed, sizeFor, spriteAllowedFor, spriteFits } from "./art";
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
