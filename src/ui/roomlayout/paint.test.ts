import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RoomLayout } from "@/lib/sprites/layout";
import { buildDrawList, type DrawOp } from "@/lib/sprites/placement";
import type { SpriteManifest } from "@/lib/sprites/types";
import type { Atlas } from "./loadAtlas";
import { paintRoom, smoothFor, tintedFrame } from "./paint";

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

describe("paintRoom catalog images", () => {
  const withImage = () => {
    const list = buildDrawList(layout, {}, manifest);
    list.ops.push({
      type: "image",
      layer: "furniture",
      src: "t1",
      version: 2,
      x: 10,
      y: 12,
      w: 24,
      h: 24,
    });
    return list;
  };

  it("draws the image 1:1 at the op position with smoothing off", () => {
    const log: Call[] = [];
    const src = {} as CanvasImageSource;
    const seen: unknown[] = [];
    const images = (id: string, v: number) => (seen.push([id, v]), src);
    expect(paintRoom(fakeCanvas(log), atlas(), withImage(), 2, undefined, images)).toBe(true);
    expect(log[0]).toEqual(["set imageSmoothingEnabled", false]);
    expect(log).toContainEqual(["drawImage", src, 10, 12, 24, 24]);
    expect(seen).toEqual([["t1", 2]]);
  });

  it("a 100 px source draws at the op size with smoothing on for that op only", () => {
    const log: Call[] = [];
    const src = { naturalWidth: 100 } as unknown as CanvasImageSource;
    paintRoom(fakeCanvas(log), atlas(), withImage(), 2, undefined, () => src);
    const at = log.findIndex((c) => c[0] === "drawImage" && c[1] === src);
    expect(log[at]).toEqual(["drawImage", src, 10, 12, 24, 24]);
    expect(log[at - 2]).toEqual(["set imageSmoothingEnabled", true]);
    expect(log[at - 1]).toEqual(["set imageSmoothingQuality", "high"]);
    expect(log[at + 1]).toEqual(["set imageSmoothingEnabled", false]);
  });

  it("a 24 px source keeps smoothing off", () => {
    const log: Call[] = [];
    const src = { naturalWidth: 24 } as unknown as CanvasImageSource;
    paintRoom(fakeCanvas(log), atlas(), withImage(), 2, undefined, () => src);
    expect(log).not.toContainEqual(["set imageSmoothingEnabled", true]);
    expect(log).toContainEqual(["drawImage", src, 10, 12, 24, 24]);
  });

  it("smoothFor: naturalWidth, plain width, missing width", () => {
    const as = (o: object) => o as CanvasImageSource;
    expect(smoothFor(as({ naturalWidth: 25 }), 24)).toBe(true);
    expect(smoothFor(as({ naturalWidth: 24 }), 24)).toBe(false);
    expect(smoothFor(as({ width: 64 }), 24)).toBe(true);
    expect(smoothFor(as({}), 24)).toBe(false);
  });

  it("a null source skips the op without throwing", () => {
    const log: Call[] = [];
    expect(paintRoom(fakeCanvas(log), atlas(), withImage(), 2)).toBe(true);
    expect(log.some((c) => c[0] === "drawImage" && c[4] === 24)).toBe(false);
  });
});

describe("paintRoom item art", () => {
  const listWith = (op: DrawOp) => {
    const list = buildDrawList(layout, {}, manifest);
    list.ops.push(op);
    return list;
  };
  const rect = { x: 40, y: 8, w: 32, h: 64 };

  it("an item image draws once at its box 1:1 with smoothing off", () => {
    const log: Call[] = [];
    const src = { naturalWidth: 32 } as unknown as CanvasImageSource;
    const list = listWith({
      type: "image",
      layer: "furniture",
      src: "item:a|s",
      version: 1,
      ...rect,
    });
    paintRoom(fakeCanvas(log), atlas(), list, 2, undefined, () => src);
    expect(log.filter((c) => c[0] === "drawImage" && c[1] === src)).toEqual([
      ["drawImage", src, 40, 8, 32, 64],
    ]);
    expect(log).not.toContainEqual(["set imageSmoothingEnabled", true]);
  });

  it("a placeholder paints fill, outline and hatch, and no image", () => {
    const log: Call[] = [];
    const list = listWith({ type: "placeholder", layer: "furniture", ...rect });
    expect(paintRoom(fakeCanvas(log), atlas(), list, 2)).toBe(true);
    expect(log).toContainEqual(["fillRect", 40, 8, 32, 64]);
    expect(log).toContainEqual(["strokeRect", 40.5, 8.5, 31, 63]);
    expect(log).toContainEqual(["lineTo", 72, 8]);
    expect(log.some((c) => c[0] === "drawImage" && c[2] === 40)).toBe(false);
  });

  it("a missing image source draws nothing and later ops still paint", () => {
    const log: Call[] = [];
    const list = listWith({
      type: "image",
      layer: "furniture",
      src: "item:a|s",
      version: 1,
      ...rect,
    });
    list.ops.push({ type: "placeholder", layer: "furniture", x: 0, y: 0, w: 32, h: 32 });
    expect(paintRoom(fakeCanvas(log), atlas(), list, 2)).toBe(true);
    expect(log).toContainEqual(["fillRect", 0, 0, 32, 32]);
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
