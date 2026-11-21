import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FRAME_KEYS, REGISTRY } from "../../src/lib/sprites/registry";

// Style guide section 7 keys; directional groups are listed by their base key.
const SECTION_7 = [
  "floor.carpet",
  "floor.carpet.alt",
  "floor.lavender",
  "floor.wood",
  "wall.top",
  "wall.face",
  "wall.face.shade",
  "wall.base",
  "wall.corner.nw",
  "wall.corner.ne",
  "wall.corner.sw",
  "wall.corner.se",
  "door",
  "window.double",
  "partition.glass",
  "desk.single",
  "desk.pair",
  "chair.office",
  "device.monitor",
  "device.monitor.dual",
  "device.pc",
  "device.laptop",
  "device.phone",
  "device.other",
  "prop.keyboard",
  "prop.mouse",
  "prop.mug",
  "prop.papers",
  "cabinet.filing",
  "shelf.books",
  "rack.server",
  "table.meeting",
  "table.coffee",
  "sofa",
  "whiteboard",
  "lamp.floor",
  "plant.small",
  "plant.large",
  "stairs",
  "elevator",
  "marker.blocked",
  "label.sign",
  "state.cannot",
  "state.pending",
  "state.mine.tint",
  "avatar.body.front",
  "avatar.body.back",
  "avatar.hair.1.front",
  "avatar.hair.2.front",
  "avatar.hair.3.front",
  "avatar.hair.1.back",
  "avatar.hair.2.back",
  "avatar.hair.3.back",
  "avatar.shirt.front",
  "avatar.shirt.back",
];

describe("sprite registry", () => {
  it("every directional group has exactly n/e/s/w and e/w tiles are s/n tiles swapped", () => {
    const groups = new Map<string, Record<string, string>>();
    for (const key of FRAME_KEYS) {
      const d = REGISTRY[key].dir;
      if (!d) continue;
      expect(key.endsWith(`.${d}`)).toBe(true);
      const base = key.slice(0, -2);
      groups.set(base, { ...groups.get(base), [d]: key });
    }
    expect(groups.size).toBeGreaterThan(0);
    for (const [base, dirs] of groups) {
      expect(Object.keys(dirs).sort(), base).toEqual(["e", "n", "s", "w"]);
      const s = REGISTRY[dirs.s].tiles;
      expect(REGISTRY[dirs.n].tiles).toEqual(s);
      if (s) {
        expect(REGISTRY[dirs.e].tiles).toEqual([s[1], s[0]]);
        expect(REGISTRY[dirs.w].tiles).toEqual([s[1], s[0]]);
      }
    }
  });

  it("registry contains every §7 key (list quoted in the test) except scene.signin", () => {
    for (const key of SECTION_7) {
      expect(REGISTRY[key] ?? REGISTRY[`${key}.s`], key).toBeDefined();
    }
    expect(FRAME_KEYS).not.toContain("scene.signin");
  });

  it("sprite-map keys and footprints match the registry", () => {
    const map = JSON.parse(readFileSync("assets/art/sprite-map.json", "utf8"));
    const keys = Object.keys(map.sprites);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(REGISTRY[key], key).toBeDefined();
      expect(map.sprites[key].tiles, key).toEqual(REGISTRY[key].tiles ?? [1, 1]);
    }
  });
});
