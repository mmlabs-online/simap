import { describe, expect, it } from "vitest";
import { HAIR_RAMP, SHIRT_RAMP, SKIN_RAMP } from "@/lib/sprites/avatar";
import type { SpriteFrame, SpriteManifest } from "@/lib/sprites/types";
import { previewOps } from "./pixel-look-preview";

const frame = (w: number, h: number, anchor: [number, number]): SpriteFrame => ({
  x: 0,
  y: 0,
  w,
  h,
  anchor,
  tiles: [1, 1],
  blocks: false,
});
const manifest = (frames: Record<string, SpriteFrame>) =>
  ({ tile: 32, frames, layers: [] }) as SpriteManifest;
const look = { skin: 1, hair: 2, style: 3 as const, shirt: 0 };

describe("previewOps", () => {
  it("ops are body, shirt, hair with the ramp tints of the look, keys for front and back and the chosen style", () => {
    const m = manifest({
      "avatar.body.front": frame(10, 20, [0, 0]),
      "avatar.shirt.front": frame(10, 10, [0, 8]),
      "avatar.hair.3.front": frame(10, 6, [0, -2]),
      "avatar.body.back": frame(10, 20, [0, 0]),
      "avatar.shirt.back": frame(10, 10, [0, 8]),
      "avatar.hair.3.back": frame(10, 6, [0, -2]),
    });
    for (const view of ["front", "back"] as const) {
      const out = previewOps(m, look, view)!;
      expect(out.ops.map((o) => [o.key, o.tint])).toEqual([
        [`avatar.body.${view}`, SKIN_RAMP[1]],
        [`avatar.shirt.${view}`, SHIRT_RAMP[0]],
        [`avatar.hair.3.${view}`, HAIR_RAMP[2]],
      ]);
    }
  });

  it("box spans all three frames; negative anchors shift every op so the minimum is 0", () => {
    const m = manifest({
      "avatar.body.front": frame(10, 20, [1, 0]),
      "avatar.shirt.front": frame(10, 10, [1, 8]),
      "avatar.hair.3.front": frame(12, 6, [0, -2]),
    });
    const out = previewOps(m, look, "front")!;
    expect(out.width).toBe(12);
    expect(out.height).toBe(22);
    expect(out.ops.map((o) => [o.x, o.y, o.w, o.h])).toEqual([
      [1, 2, 10, 20],
      [1, 10, 10, 10],
      [0, 0, 12, 6],
    ]);
  });

  it("a missing frame returns null", () => {
    const m = manifest({ "avatar.body.front": frame(10, 20, [0, 0]) });
    expect(previewOps(m, look, "front")).toBeNull();
  });
});
