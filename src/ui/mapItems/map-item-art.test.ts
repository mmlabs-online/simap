import { describe, expect, it } from "vitest";
import { mapItemImageFits, spriteAllowedFor, spriteFits } from "@/lib/map-items/art";
import { LIBRARY_ITEMS } from "@/lib/map-items/library";
import { itemImageId } from "@/lib/sprites/item-art";
import { REGISTRY } from "@/lib/sprites/registry";
import type { Direction } from "@/lib/sprites/types";
import {
  artDirs,
  artImageEntries,
  artPanelView,
  expectedImageSize,
  findArtItem,
  isCustomised,
  panelFrameKey,
  spriteChoices,
  thumbDir,
  thumbSprite,
} from "./map-item-art";
import { dto } from "./test-items";

const art = (sprite: string | null, hasImage: boolean, imageVersion = 0) => ({
  sprite,
  hasImage,
  imageVersion,
});
const DIRS: Direction[] = ["n", "e", "s", "w"];

describe("artDirs", () => {
  it("directional items get n,e,s,w; non-directional and floors get s only", () => {
    expect(artDirs(dto("desk.single"))).toEqual(["n", "e", "s", "w"]);
    expect(artDirs(dto("plant.large"))).toEqual(["s"]);
    expect(artDirs(dto("floor.wood"))).toEqual(["s"]);
    expect(artDirs(dto("chair.office"))).toEqual(
      artDirs({ directional: dto("chair.office").directional }),
    );
  });
});

describe("artPanelView", () => {
  const base = dto("desk.single");
  const withArt = (a: ReturnType<typeof art>) => ({ ...base, art: { ...base.art, n: a } });
  it("image wins over sprite over library; spriteHidden when both set; canRemove only with image; canUseLibrary only with a sprite", () => {
    expect(artPanelView(base, "n")).toEqual({
      source: "library",
      spriteKey: null,
      spriteHidden: false,
      canRemove: false,
      canUseLibrary: false,
    });
    expect(artPanelView(withArt(art("desk.single.n", false)), "n")).toMatchObject({
      source: "sprite",
      spriteKey: "desk.single.n",
      spriteHidden: false,
      canRemove: false,
      canUseLibrary: true,
    });
    expect(artPanelView(withArt(art(null, true, 2)), "n")).toMatchObject({
      source: "image",
      spriteHidden: false,
      canRemove: true,
      canUseLibrary: false,
    });
    expect(artPanelView(withArt(art("desk.single.n", true, 2)), "n")).toMatchObject({
      source: "image",
      spriteHidden: true,
      canRemove: true,
      canUseLibrary: true,
    });
  });
});

describe("expectedImageSize", () => {
  it("table.meeting 3x2 n -> 96 x 64..96, e -> 64 x 96..128; floor -> exactly 32 x 32", () => {
    const t = dto("table.meeting");
    expect([t.w, t.h]).toEqual([3, 2]);
    expect(expectedImageSize(t, "n")).toEqual({ w: 96, hMin: 64, hMax: 96 });
    expect(expectedImageSize(t, "e")).toEqual({ w: 64, hMin: 96, hMax: 128 });
    expect(expectedImageSize(dto("floor.wood"), "s")).toEqual({ w: 32, hMin: 32, hMax: 32 });
  });

  it("agrees with mapItemImageFits for every item, allowed dir and px in 0..160", () => {
    for (const lib of LIBRARY_ITEMS) {
      const item = dto(lib.builtinKey);
      for (const dir of artDirs(item)) {
        const e = expectedImageSize(item, dir);
        for (let px = 0; px <= 160; px++) {
          for (const width of [e.w - 1, e.w, e.w + 1]) {
            expect(mapItemImageFits(item, dir, item.w, item.h, { width, height: px })).toBe(
              width === e.w && px >= e.hMin && px <= e.hMax,
            );
          }
        }
      }
    }
  });
});

describe("spriteChoices", () => {
  it("every key passes spriteAllowedFor and spriteFits; floor items get only floor frames; others never floor; grouped in name order, keys sorted; e/w use swapped size", () => {
    for (const lib of LIBRARY_ITEMS) {
      const item = dto(lib.builtinKey);
      for (const dir of DIRS) {
        const groups = spriteChoices(item, dir);
        const names = groups.map((g) => g.group);
        expect(names).toEqual([...names].sort());
        for (const g of groups) {
          expect(g.keys).toEqual([...g.keys].sort());
          for (const k of g.keys) {
            expect(spriteAllowedFor(item, k)).toBe(true);
            expect(spriteFits(k, dir, item.w, item.h)).toBe(true);
            expect(REGISTRY[k]!.group).toBe(g.group);
            expect(REGISTRY[k]!.layer === "floor").toBe(item.kind === "floor");
          }
        }
      }
    }
    // 2x1 desk: a 2x1 frame fits north but not east (1 wide, 2 tall).
    const desk = dto("desk.single");
    const keys = (d: Direction) => spriteChoices(desk, d).flatMap((g) => g.keys);
    expect(keys("n")).toContain("desk.single.n");
    expect(keys("e")).not.toContain("desk.single.n");
    expect(keys("e")).toContain("desk.single.e");
  });

  it("for a 1x1 item excludes frames larger than 1x1", () => {
    const item = { ...dto("plant.large"), w: 1, h: 1 };
    for (const g of spriteChoices(item, "s")) {
      for (const k of g.keys) {
        const [w, h] = REGISTRY[k]!.tiles ?? [1, 1];
        expect(w <= 1 && h <= 1).toBe(true);
      }
    }
  });
});

describe("artImageEntries", () => {
  it("ids are itemImageId(key, dir); hasImage/imageVersion copied; never makes an entry for a direction the item does not allow", () => {
    const desk = dto("desk.single");
    const plant = {
      ...dto("plant.large"),
      art: { ...dto("plant.large").art, n: art(null, true, 9), s: art(null, true, 4) },
    };
    const deskWithImage = { ...desk, art: { ...desk.art, e: art(null, true, 3) } };
    const entries = artImageEntries([deskWithImage, plant]);
    expect(entries.filter((e) => e.id.startsWith("item:desk.single|"))).toHaveLength(4);
    expect(entries.find((e) => e.id === itemImageId("desk.single", "e"))).toEqual({
      id: "item:desk.single|e",
      hasImage: true,
      imageVersion: 3,
    });
    const plants = entries.filter((e) => e.id.startsWith("item:plant.large|"));
    expect(plants).toEqual([{ id: "item:plant.large|s", hasImage: true, imageVersion: 4 }]);
  });
});

describe("isCustomised", () => {
  it("true with any image or sprite in an allowed dir", () => {
    const desk = dto("desk.single");
    expect(isCustomised(desk)).toBe(false);
    expect(isCustomised({ ...desk, art: { ...desk.art, w: art(null, true, 1) } })).toBe(true);
    expect(isCustomised({ ...desk, art: { ...desk.art, e: art("desk.single.e", false) } })).toBe(
      true,
    );
    const plant = dto("plant.large");
    expect(isCustomised({ ...plant, art: { ...plant.art, n: art(null, true, 1) } })).toBe(false);
    expect(isCustomised({ ...plant, art: { ...plant.art, s: art("plant.large", false) } })).toBe(
      true,
    );
  });
});

describe("thumbDir", () => {
  it("s first, then n, e, w; null with no image", () => {
    const d = dto("desk.single");
    const set = (...dirs: Direction[]) => ({
      ...d,
      art: { ...d.art, ...Object.fromEntries(dirs.map((x) => [x, art(null, true, 1)])) },
    });
    expect(thumbDir(d)).toBeNull();
    expect(thumbDir(set("w", "e", "s"))).toBe("s");
    expect(thumbDir(set("w", "e", "n"))).toBe("n");
    expect(thumbDir(set("w", "e"))).toBe("e");
    expect(thumbDir(set("w"))).toBe("w");
    expect(thumbDir({ ...d, art: { ...d.art, s: art("x", false) } })).toBeNull();
  });
});

describe("findArtItem", () => {
  it("finds the item by key and is undefined once it left the list", () => {
    const items = [dto("table.meeting"), dto("plant.large")];
    expect(findArtItem(items, "plant.large")).toBe(items[1]);
    expect(findArtItem(items, "gone")).toBeUndefined();
    expect(findArtItem([], "plant.large")).toBeUndefined();
  });
});

describe("panelFrameKey", () => {
  const withArt = (key: string, dir: Direction, sprite: string | null, hasImage: boolean) => {
    const d = dto(key);
    return { ...d, art: { ...d.art, [dir]: art(sprite, hasImage) } };
  };
  it("is null with an image, the chosen sprite, else the library frame per direction", () => {
    expect(panelFrameKey(withArt("desk.single", "n", "desk.single.n", true), "n")).toBeNull();
    expect(panelFrameKey(withArt("desk.single", "n", "desk.single.e", false), "n")).toBe(
      "desk.single.e",
    );
    for (const d of DIRS) expect(panelFrameKey(dto("desk.single"), d)).toBe(`desk.single.${d}`);
    expect(panelFrameKey(dto("plant.large"), "s")).toBe("plant.large");
  });
  it("is null when the key is not in the registry", () => {
    expect(panelFrameKey(dto("desk.single", { builtinKey: "nope" }), "s")).toBeNull();
  });
});

describe("thumbSprite", () => {
  it("picks s, n, e, w in order; ignores directions the item lacks; null without a sprite", () => {
    const d = dto("desk.single");
    const set = (o: Partial<Record<Direction, string>>) => ({
      ...d,
      art: Object.fromEntries(DIRS.map((x) => [x, art(o[x] ?? null, false)])) as typeof d.art,
    });
    expect(thumbSprite(set({ w: "w1", e: "e1", n: "n1", s: "s1" }))).toBe("s1");
    expect(thumbSprite(set({ w: "w1", e: "e1" }))).toBe("e1");
    expect(thumbSprite(d)).toBeNull();
    const p = dto("plant.large");
    expect(thumbSprite({ ...p, art: { ...p.art, n: art("x", false) } })).toBeNull();
  });
});
