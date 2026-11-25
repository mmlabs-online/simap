import { describe, expect, it } from "vitest";
import { atlasFrame, containRect, frameRect } from "./frame-preview";

const f = (w: number, h: number) => ({ x: 10, y: 20, w, h });

describe("frameRect", () => {
  it("maps the frame to the source rect and the scaled destination", () => {
    expect(frameRect(f(64, 48), 1)).toEqual({
      sx: 10,
      sy: 20,
      sw: 64,
      sh: 48,
      dx: 0,
      dy: 0,
      dw: 64,
      dh: 48,
    });
    expect(frameRect(f(64, 48), 2)).toMatchObject({ dw: 128, dh: 96 });
  });
  it("rejects non-integer or non-positive scales and unusable frames", () => {
    for (const s of [0, -1, 1.5, NaN]) expect(frameRect(f(32, 32), s)).toBeNull();
    expect(frameRect(f(0, 32), 1)).toBeNull();
  });
});

describe("containRect", () => {
  it("scales a large frame down, keeps the aspect ratio, centres it and smooths", () => {
    expect(containRect(f(128, 64), 32)).toEqual({
      sx: 10,
      sy: 20,
      sw: 128,
      sh: 64,
      dx: 0,
      dy: 8,
      dw: 32,
      dh: 16,
      smooth: true,
    });
  });
  it("draws a small frame at 1x, centred, not smoothed", () => {
    expect(containRect(f(16, 8), 32)).toMatchObject({
      dx: 8,
      dy: 12,
      dw: 16,
      dh: 8,
      smooth: false,
    });
  });
  it("draws a 1x1 frame; a zero-size frame is null", () => {
    expect(containRect(f(1, 1), 32)).toMatchObject({ dw: 1, dh: 1, smooth: false });
    expect(containRect(f(0, 5), 32)).toBeNull();
    expect(containRect(f(5, 0), 32)).toBeNull();
  });
});

describe("atlasFrame", () => {
  it("finds own keys only", () => {
    const frames = { a: { ...f(1, 1), anchor: [0, 0], tiles: [1, 1], blocks: false } } as never;
    expect(atlasFrame(frames, "a")).not.toBeNull();
    expect(atlasFrame(frames, "toString")).toBeNull();
    expect(atlasFrame(frames, null)).toBeNull();
  });
});
