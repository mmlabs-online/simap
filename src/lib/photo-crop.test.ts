import { describe, expect, it, vi } from "vitest";
import {
  JPEG_QUALITIES,
  PHOTO_INPUT_LIMITS,
  centerSquare,
  fitToLimit,
  halvingSteps,
  targetSide,
} from "./photo-crop";

const bytes = (n: number) => new Uint8Array(n);

describe("centerSquare", () => {
  it("centers the largest square", () => {
    expect(centerSquare(4032, 3024)).toEqual({ sx: 504, sy: 0, side: 3024 });
    expect(centerSquare(3024, 4032)).toEqual({ sx: 0, sy: 504, side: 3024 });
    expect(centerSquare(600, 600)).toEqual({ sx: 0, sy: 0, side: 600 });
    expect(centerSquare(101, 50)).toEqual({ sx: 25, sy: 0, side: 50 });
  });
});

describe("targetSide", () => {
  it("clamps to 64..512", () => {
    expect([3024, 512, 300, 64, 30, 1].map(targetSide)).toEqual([512, 512, 300, 64, 64, 64]);
  });
});

describe("halvingSteps", () => {
  it("halves down to the target", () => {
    expect(halvingSteps(3024, 512)).toEqual([1512, 756, 512]);
    expect(halvingSteps(1024, 512)).toEqual([512]);
    expect(halvingSteps(1100, 512)).toEqual([550, 512]);
    expect(halvingSteps(300, 300)).toEqual([300]);
    expect(halvingSteps(30, 64)).toEqual([64]);
  });

  it("last step is the target, every step is at least the target and at least half the previous", () => {
    for (const side of [64, 65, 300, 513, 1100, 3024, 8000]) {
      const target = targetSide(side);
      const steps = halvingSteps(side, target);
      expect(steps[steps.length - 1]).toBe(target);
      let prev = side;
      for (const s of steps) {
        expect(s).toBeGreaterThanOrEqual(target);
        expect(s).toBeGreaterThanOrEqual(prev / 2 - 1);
        prev = s;
      }
    }
  });
});

describe("fitToLimit", () => {
  it("no alpha: never tries PNG, returns the first JPEG within the limit and stops", async () => {
    const encode = vi.fn(async (_t: string, q?: number) => bytes(q! > 0.9 ? 300 : 100));
    const r = await fitToLimit(encode, { hasAlpha: false, maxBytes: 200 });
    expect(r.ok && r.type).toBe("jpeg");
    expect(encode.mock.calls.map((c) => c[0])).toEqual(["jpeg", "jpeg"]);
    expect(encode.mock.calls[1]![1]).toBe(0.85);
  });

  it("alpha and PNG fits: PNG with one encode call", async () => {
    const encode = vi.fn(async () => bytes(100));
    const r = await fitToLimit(encode, { hasAlpha: true, maxBytes: 200 });
    expect(r.ok && r.type).toBe("png");
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it("alpha and PNG too big: falls back to the JPEG ladder", async () => {
    const encode = vi.fn(async (t: string) => bytes(t === "png" ? 300 : 100));
    const r = await fitToLimit(encode, { hasAlpha: true, maxBytes: 200 });
    expect(r.ok && r.type).toBe("jpeg");
    expect(encode).toHaveBeenCalledTimes(2);
  });

  it("every quality too big: image_could_not_shrink after the whole ladder", async () => {
    const encode = vi.fn(async () => bytes(300));
    expect(await fitToLimit(encode, { hasAlpha: false, maxBytes: 200 })).toEqual({
      ok: false,
      code: "image_could_not_shrink",
    });
    expect(encode).toHaveBeenCalledTimes(JPEG_QUALITIES.length);
  });

  it("encode returns null: read_failed", async () => {
    expect(await fitToLimit(async () => null, { hasAlpha: false })).toEqual({
      ok: false,
      code: "read_failed",
    });
  });
});

describe("constants", () => {
  it("quality ladder is strictly descending and ends at 0.4; input caps are 20 MB / 50 MP", () => {
    for (let i = 1; i < JPEG_QUALITIES.length; i++) {
      expect(JPEG_QUALITIES[i]!).toBeLessThan(JPEG_QUALITIES[i - 1]!);
    }
    expect(JPEG_QUALITIES[JPEG_QUALITIES.length - 1]).toBe(0.4);
    expect(PHOTO_INPUT_LIMITS).toEqual({ maxBytes: 20 * 1024 * 1024, maxPixels: 50_000_000 });
  });
});
