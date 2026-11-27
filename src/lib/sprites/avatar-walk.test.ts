import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HAIR_STYLES, WALK_DIRS, WALK_STEPS, walkFrameKeys } from "./avatar";
import { REGISTRY } from "./registry";
import type { SpriteManifest } from "./types";

const manifest = JSON.parse(
  readFileSync(new URL("../../../public/sprites/office.json", import.meta.url), "utf8"),
) as SpriteManifest;

describe("avatar walking frames", () => {
  it("committed manifest and registry have every walk frame for every layer, direction and step", () => {
    const layers = ["body", "shirt", ...HAIR_STYLES.map((s) => `hair.${s}`)];
    for (const layer of layers) {
      for (const dir of WALK_DIRS) {
        for (let step = 0; step < WALK_STEPS; step++) {
          const key = `avatar.${layer}.walk.${dir}.${step}`;
          expect(REGISTRY[key], key).toBeDefined();
          const frame = manifest.frames[key];
          expect(frame, key).toBeDefined();
          expect([frame.w, frame.h], key).toEqual([32, 32]);
          expect(frame.anchor, key).toEqual([0, 0]);
          expect(frame.blocks, key).toBe(false);
        }
      }
    }
  });

  it("walkFrameKeys has 40 keys and equals the registry's .walk. avatar keys", () => {
    const keys = walkFrameKeys();
    expect(keys).toHaveLength(40);
    const registered = Object.keys(REGISTRY)
      .filter((k) => k.startsWith("avatar.") && k.includes(".walk."))
      .sort();
    expect(keys).toEqual(registered);
  });

  it("every walk key's layer is avatar and its group avatar (never offered as catalog art)", () => {
    for (const key of walkFrameKeys()) {
      expect(REGISTRY[key].layer, key).toBe("avatar");
      expect(REGISTRY[key].group, key).toBe("avatar");
    }
  });
});
