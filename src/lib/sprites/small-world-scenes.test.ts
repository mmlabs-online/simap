import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPixelLook } from "./pixel-look";
import { chairFor, resolveFrameKey, ROTATION_TO_DIR } from "./placement";
import { REGISTRY } from "./registry";
import {
  avatarDrawList,
  CARD_LOOK,
  WALKER_LOOKS,
  WORLD_LAYOUTS,
  WORLD_ROOMS,
  WORLD_SEAT_VIEWS,
  WORLD_STANDING,
} from "./small-world-scenes";
import type { SpriteManifest } from "./types";

const manifest = JSON.parse(
  readFileSync(new URL("../../../public/sprites/office.json", import.meta.url), "utf8"),
) as SpriteManifest;

const ids = WORLD_ROOMS.map((r) => r.id);

describe("small world scenes", () => {
  it("every room is 12x7 and every sprite resolves to a registry key", () => {
    expect(ids).toEqual(["focus", "meeting", "lounge", "cafe"]);
    for (const id of ids) {
      const l = WORLD_LAYOUTS[id];
      expect([l.w, l.h]).toEqual([12, 7]);
      for (const p of [...l.floors, ...l.seats, ...l.fixtures]) {
        const key = resolveFrameKey(p.sprite, "rotation" in p ? p.rotation : 0);
        expect(key, `${id} ${p.sprite}`).not.toBeNull();
        expect(Object.hasOwn(REGISTRY, key!), p.sprite).toBe(true);
      }
    }
  });

  it("draws with no unknown sprite and bounds exactly 384x224", () => {
    for (const r of WORLD_ROOMS) {
      const list = r.drawList(manifest);
      expect(list.unknown, r.id).toEqual([]);
      expect(list.bounds, r.id).toEqual({ x: 0, y: 0, w: 384, h: 224 });
    }
  });

  it("uses integer rects and only frames from the manifest", () => {
    const lists = [
      ...WORLD_ROOMS.map((r) => r.drawList(manifest)),
      avatarDrawList(CARD_LOOK, manifest),
    ];
    for (const list of lists)
      for (const op of list.ops) {
        for (const n of [op.x, op.y, op.w, op.h]) expect(Number.isInteger(n)).toBe(true);
        if (op.type === "frame") expect(manifest.frames[op.key]).toBeDefined();
      }
  });

  it("floor zones cover all 84 tiles", () => {
    for (const id of ids) {
      const covered = new Set<string>();
      for (const z of WORLD_LAYOUTS[id].floors)
        for (let y = z.y; y < z.y + z.h; y++)
          for (let x = z.x; x < z.x + z.w; x++) covered.add(`${x},${y}`);
      expect(covered.size, id).toBe(84);
    }
  });

  it("blocking furniture, chairs and standing avatars never share a tile", () => {
    for (const id of ids) {
      const l = WORLD_LAYOUTS[id];
      const tiles = new Map<string, string>();
      const claim = (x: number, y: number, w: number, d: number, what: string) => {
        for (let ty = y; ty < y + d; ty++)
          for (let tx = x; tx < x + w; tx++) {
            const k = `${tx},${ty}`;
            expect(tiles.has(k), `${id}: ${what} overlaps ${tiles.get(k)} at ${k}`).toBe(false);
            tiles.set(k, what);
          }
      };
      for (const p of [...l.seats, ...l.fixtures]) {
        const key = resolveFrameKey(p.sprite, p.rotation)!;
        const f = manifest.frames[key];
        // Wall-row items (windows, clock, board) sit on rows 0-1 and never share tiles with the floor.
        if (f.blocks && REGISTRY[key].tiles !== null) claim(p.x, p.y, f.tiles[0], f.tiles[1], p.id);
      }
      for (const s of l.seats) {
        const key = resolveFrameKey(s.sprite, s.rotation)!;
        const dir = REGISTRY[key].dir ?? ROTATION_TO_DIR[s.rotation];
        const c = chairFor(s, manifest.frames[key].tiles, dir);
        claim(c.x, c.y, 1, 1, `${s.id}:chair`);
      }
      for (const s of WORLD_STANDING[id]) {
        expect(s.ty).toBeGreaterThanOrEqual(2);
        expect(s.tx).toBeLessThan(12);
        expect(s.ty).toBeLessThan(7);
        claim(s.tx, s.ty, 1, 1, "standing");
      }
    }
  });

  it("idle avatars: fixed looks, expected count, no overlay", () => {
    for (const r of WORLD_ROOMS) {
      const views = Object.values(WORLD_SEAT_VIEWS[r.id]);
      expect(views).toHaveLength(WORLD_LAYOUTS[r.id].seats.length);
      for (const v of views) {
        expect(v.state).toBe("occupied");
        expect(isPixelLook(v.look)).toBe(true);
      }
      for (const s of WORLD_STANDING[r.id]) expect(isPixelLook(s.look)).toBe(true);
      const list = r.drawList(manifest);
      const expected = 3 * (views.length + WORLD_STANDING[r.id].length);
      expect(
        list.ops.filter((o) => o.layer === "avatar"),
        r.id,
      ).toHaveLength(expected);
      expect(list.ops.some((o) => o.layer === "overlay")).toBe(false);
    }
    for (const l of [...WALKER_LOOKS, CARD_LOOK]) expect(isPixelLook(l)).toBe(true);
  });

  it("avatarDrawList uses only manifest avatar frames, 32x32", () => {
    const list = avatarDrawList(CARD_LOOK, manifest);
    expect(list.ops).toHaveLength(3);
    expect(list.ops.map((o) => (o.type === "frame" ? o.key : ""))).toEqual([
      "avatar.body.front",
      "avatar.shirt.front",
      `avatar.hair.${CARD_LOOK.style}.front`,
    ]);
    for (const o of list.ops) {
      expect(o.layer).toBe("avatar");
      expect(o.type === "frame" && o.tint).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(list.bounds).toEqual({ x: 0, y: 0, w: 32, h: 32 });
    expect(list.unknown).toEqual([]);

    const m = structuredClone(manifest);
    delete m.frames["avatar.shirt.front"];
    const partial = avatarDrawList(CARD_LOOK, m);
    expect(partial.unknown).toEqual(["avatar.shirt.front"]);
    expect(partial.ops).toHaveLength(2);
  });
});
