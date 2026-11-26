import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPixelLook } from "./pixel-look";
import { chairFor, resolveFrameKey } from "./placement";
import { REGISTRY } from "./registry";
import { SIGNIN_SCENE, SIGNIN_SCENE_PX, SIGNIN_SEAT_VIEWS, signinDrawList } from "./signin-scene";
import type { SpriteManifest } from "./types";

const manifest = JSON.parse(
  readFileSync(new URL("../../../public/sprites/office.json", import.meta.url), "utf8"),
) as SpriteManifest;

describe("sign-in scene", () => {
  it("is 12x7 and every sprite resolves to a registry key", () => {
    expect([SIGNIN_SCENE.w, SIGNIN_SCENE.h]).toEqual([12, 7]);
    const all = [...SIGNIN_SCENE.floors, ...SIGNIN_SCENE.seats, ...SIGNIN_SCENE.fixtures];
    for (const p of all) {
      const key = resolveFrameKey(p.sprite, "rotation" in p ? p.rotation : 0);
      expect(key, p.sprite).not.toBeNull();
      expect(Object.hasOwn(REGISTRY, key!), p.sprite).toBe(true);
    }
  });

  it("draws with no unknown sprite and bounds exactly the scene box", () => {
    const list = signinDrawList(manifest);
    expect(list.unknown).toEqual([]);
    expect(list.bounds).toEqual({ x: 0, y: 0, ...SIGNIN_SCENE_PX });
    expect(SIGNIN_SCENE_PX).toEqual({ w: 384, h: 224 });
  });

  it("uses integer rects and only frames from the manifest", () => {
    for (const op of signinDrawList(manifest).ops) {
      for (const n of [op.x, op.y, op.w, op.h]) expect(Number.isInteger(n)).toBe(true);
      if (op.type === "frame") expect(manifest.frames[op.key]).toBeDefined();
    }
  });

  it("floor zones cover all 84 tiles", () => {
    const covered = new Set<string>();
    for (const z of SIGNIN_SCENE.floors)
      for (let y = z.y; y < z.y + z.h; y++)
        for (let x = z.x; x < z.x + z.w; x++) covered.add(`${x},${y}`);
    expect(covered.size).toBe(84);
  });

  it("has two seated demo avatars with fixed looks and no overlay", () => {
    const views = Object.values(SIGNIN_SEAT_VIEWS);
    expect(views.filter((v) => v.avatarSeed !== null)).toHaveLength(2);
    for (const v of views) {
      expect(v.state).toBe("occupied");
      expect(isPixelLook(v.look)).toBe(true);
    }
    const list = signinDrawList(manifest);
    expect(list.ops.filter((o) => o.layer === "avatar")).toHaveLength(6);
    expect(list.ops.some((o) => o.layer === "overlay")).toBe(false);
  });

  it("blocking full-tile furniture and chairs never share a tile", () => {
    const tiles = new Map<string, string>();
    const claim = (x: number, y: number, w: number, d: number, id: string) => {
      for (let ty = y; ty < y + d; ty++)
        for (let tx = x; tx < x + w; tx++) {
          const k = `${tx},${ty}`;
          expect(tiles.has(k), `${id} overlaps ${tiles.get(k)} at ${k}`).toBe(false);
          tiles.set(k, id);
        }
    };
    const blocking = (sprite: string, rotation: 0) => {
      const key = resolveFrameKey(sprite, rotation)!;
      const f = manifest.frames[key];
      return f.blocks && REGISTRY[key].tiles !== null ? f.tiles : null;
    };
    for (const p of [...SIGNIN_SCENE.seats, ...SIGNIN_SCENE.fixtures]) {
      const t = blocking(p.sprite, 0);
      if (t) claim(p.x, p.y, t[0], t[1], p.id);
    }
    for (const s of SIGNIN_SCENE.seats) {
      const key = resolveFrameKey(s.sprite, 0)!;
      const c = chairFor(s, manifest.frames[key].tiles, "s");
      claim(c.x, c.y, 1, 1, `${s.id}:chair`);
    }
  });

  it("a manifest without window.double does not throw and reports it", () => {
    const m = structuredClone(manifest);
    delete m.frames["window.double"];
    const list = signinDrawList(m);
    expect(list.unknown).toContain("window.double");
  });
});
