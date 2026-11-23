import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RoomLayout } from "@/lib/sprites/layout";
import { buildDrawList } from "@/lib/sprites/placement";
import type { SpriteManifest } from "@/lib/sprites/types";
import type { Atlas } from "./loadAtlas";
import { paintRoom, tintedFrame } from "./paint";

const manifest = JSON.parse(
  readFileSync(new URL("../../../public/sprites/office.json", import.meta.url), "utf8"),
) as SpriteManifest;

type Call = [string, ...unknown[]];

function fakeCanvas(log: Call[], withContext = true) {
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, name: string) =>
      name in target
        ? target[name]
        : (...args: unknown[]) => {
            log.push([name, ...args]);
          },
    set: (target, name: string, value) => {
      target[name] = value;
      log.push([`set ${name}`, value]);
      return true;
    },
  });
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (withContext ? ctx : null),
  };
  return canvas as unknown as HTMLCanvasElement;
}

const atlas = (): Atlas => ({ manifest, image: {} as HTMLImageElement });

const layout: RoomLayout = {
  w: 4,
  h: 3,
  floors: [],
  seats: [],
  fixtures: [{ id: "p", sprite: "plant.large", x: 1, y: 0, rotation: 0 }],
};

describe("paintRoom", () => {
  it("sets smoothing off after every resize", () => {
    const log: Call[] = [];
    const canvas = fakeCanvas(log);
    const list = buildDrawList(layout, {}, manifest);
    for (const zoom of [2, 3, 4]) {
      log.length = 0;
      expect(paintRoom(canvas, atlas(), list, zoom)).toBe(true);
      expect(log[0]).toEqual(["set imageSmoothingEnabled", false]);
    }
  });

  it("uses integer canvas size and offsets at every zoom", () => {
    const list = buildDrawList(layout, {}, manifest);
    for (const zoom of [2, 3, 4]) {
      const canvas = fakeCanvas([]);
      paintRoom(canvas, atlas(), list, zoom);
      expect(canvas.width).toBe(list.bounds.w * zoom);
      expect(canvas.height).toBe(list.bounds.h * zoom);
      expect(Number.isInteger(canvas.width) && Number.isInteger(canvas.height)).toBe(true);
    }
    expect(Number.isInteger(list.bounds.x) && Number.isInteger(list.bounds.y)).toBe(true);
  });

  it("translates by the negative bounds origin", () => {
    const log: Call[] = [];
    const list = buildDrawList(layout, {}, manifest);
    expect(list.bounds.y).toBeLessThan(0);
    paintRoom(fakeCanvas(log), atlas(), list, 3);
    expect(log).toContainEqual(["scale", 3, 3]);
    expect(log).toContainEqual(["translate", -list.bounds.x, -list.bounds.y]);
  });

  it("refuses a canvas over the cap without resizing", () => {
    const big: RoomLayout = { ...layout, w: 64, h: 64 };
    const list = buildDrawList(big, {}, manifest);
    const canvas = fakeCanvas([]);
    expect(paintRoom(canvas, atlas(), list, 3)).toBe(false);
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });

  it("returns false when the canvas did not take the requested size", () => {
    const list = buildDrawList(layout, {}, manifest);
    const canvas = fakeCanvas([]);
    Object.defineProperty(canvas, "width", { get: () => 0, set: () => {} });
    expect(paintRoom(canvas, atlas(), list, 2)).toBe(false);
  });

  it("returns false without a 2D context", () => {
    const list = buildDrawList(layout, {}, manifest);
    expect(paintRoom(fakeCanvas([], false), atlas(), list, 2)).toBe(false);
  });
});

describe("tintedFrame", () => {
  it("tint resets the composite to source-over and is cached per atlas", () => {
    const log: Call[] = [];
    const a = atlas();
    const make = () => fakeCanvas(log);
    const first = tintedFrame(a, "avatar.body.front", "#e8b48f", make);
    const second = tintedFrame(a, "avatar.body.front", "#e8b48f", make);
    expect(second).toBe(first);
    const composites = log.filter((c) => c[0] === "set globalCompositeOperation").map((c) => c[1]);
    expect(composites).toEqual(["multiply", "destination-in", "source-over"]);
    expect(tintedFrame(a, "avatar.body.front", "#000000", make)).not.toBe(first);
    expect(tintedFrame(atlas(), "avatar.body.front", "#e8b48f", make)).not.toBe(first);
    expect(tintedFrame(a, "nope", "#000000", make)).toBeNull();
  });
});
