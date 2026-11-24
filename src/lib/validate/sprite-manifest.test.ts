import { describe, expect, it } from "vitest";
import { FRAME_KEYS, LAYERS, REGISTRY } from "@/lib/sprites/registry";
import { validateSpriteManifest } from "./sprite-manifest";

const ATLAS = { w: 1024, h: 1024 };

function build(): Record<string, any> {
  const frames: Record<string, unknown> = {};
  FRAME_KEYS.forEach((key, i) => {
    frames[key] = {
      x: i * 2,
      y: 0,
      w: 1,
      h: 1,
      anchor: [0, 0],
      tiles: REGISTRY[key].tiles ?? [1, 1],
      blocks: REGISTRY[key].blocks,
    };
  });
  return { tile: 32, frames, layers: [...LAYERS] };
}

const errorsOf = (json: unknown) => {
  const r = validateSpriteManifest(json, ATLAS);
  return r.ok ? [] : r.errors;
};

describe("validateSpriteManifest", () => {
  it("accepts a minimal manifest with every registry frame", () => {
    expect(validateSpriteManifest(build(), ATLAS).ok).toBe(true);
  });

  it("rejects an unknown frame key", () => {
    const m = build();
    m.frames["desk.bogus.s"] = m.frames["desk.single.s"];
    expect(errorsOf(m)).toContainEqual({ path: "frames.desk.bogus.s", message: "unknown key" });
  });

  it("rejects a frame outside the atlas (x+w > atlas.w, y+h > atlas.h, negative x)", () => {
    const m = build();
    m.frames["sofa"].x = 1023;
    m.frames["sofa"].w = 2;
    m.frames["plant.large"].y = 1023;
    m.frames["plant.large"].h = 2;
    m.frames["plant.small"].x = -1;
    expect(errorsOf(m).map((e) => e.path)).toEqual(
      expect.arrayContaining(["frames.sofa", "frames.plant.large", "frames.plant.small.x"]),
    );
  });

  it("rejects a directional group missing one direction (desk.single.w removed)", () => {
    const m = build();
    delete m.frames["desk.single.w"];
    const e = errorsOf(m);
    expect(e).toHaveLength(1);
    expect(e[0].message).toContain('direction "w"');
  });

  it("rejects a missing non-directional frame", () => {
    const m = build();
    delete m.frames["sofa"];
    expect(errorsOf(m)).toEqual([{ path: "frames.sofa", message: "missing frame" }]);
  });

  it("rejects tile != 32, wrong or reordered layers, bad geometry and blocks", () => {
    const m = build();
    m.tile = 16;
    m.layers = [...LAYERS].reverse();
    expect(errorsOf(m).map((e) => e.path)).toEqual(["tile", "layers"]);
    const g = build();
    g.frames["sofa"].w = 0;
    g.frames["sofa"].h = 1.5;
    g.frames["sofa"].anchor = [0.5, 0];
    g.frames["sofa"].tiles = [0, 1];
    g.frames["sofa"].blocks = "yes";
    expect(errorsOf(g).map((e) => e.path)).toEqual(
      expect.arrayContaining([
        "frames.sofa.w",
        "frames.sofa.h",
        "frames.sofa.anchor",
        "frames.sofa.tiles",
        "frames.sofa.blocks",
      ]),
    );
  });

  it("rejects frame tiles that differ from the registry", () => {
    const m = build();
    m.frames["desk.single.s"].tiles = [1, 1];
    expect(errorsOf(m)).toEqual([
      { path: "frames.desk.single.s.tiles", message: "must match the registry footprint 2x1" },
    ]);
  });

  it("accepts negative anchors and an optional meta object; rejects unknown top-level fields", () => {
    const m = build();
    m.frames["sofa"].anchor = [-2, -21];
    m.meta = { generator: "x", version: "y", sources: {} };
    expect(validateSpriteManifest(m, ATLAS).ok).toBe(true);
    m.extra = 1;
    expect(errorsOf(m)).toContainEqual({ path: "extra", message: "unknown top-level field" });
  });

  it("returns all errors with paths, never throws on garbage input (null, array, string)", () => {
    for (const bad of [null, [], "x", 3, {}]) {
      expect(validateSpriteManifest(bad, ATLAS).ok).toBe(false);
    }
    expect(errorsOf({ tile: 32, frames: {}, layers: [] }).length).toBeGreaterThan(50);
  });
});
