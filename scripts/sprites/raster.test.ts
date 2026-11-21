import { describe, expect, it } from "vitest";
import { create, fillRect, outline, scaleNearest } from "./raster.mjs";

const px = (img: { w: number; data: Uint8Array }, x: number, y: number) => [
  ...img.data.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4),
];

describe("raster", () => {
  it("outline draws a 1 px #2a3140 ring outside the silhouette only", () => {
    const img = create(5, 5);
    fillRect(img, 1, 1, 3, 3, "#ffffff");
    outline(img, "#2a3140");
    expect(px(img, 0, 1)).toEqual([0x2a, 0x31, 0x40, 255]);
    expect(px(img, 2, 0)).toEqual([0x2a, 0x31, 0x40, 255]);
    expect(px(img, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(px(img, 2, 2)).toEqual([255, 255, 255, 255]);
  });

  it("scaleNearest(2) duplicates pixels exactly", () => {
    const img = create(2, 1);
    fillRect(img, 0, 0, 1, 1, "#ff0000");
    fillRect(img, 1, 0, 1, 1, "#00ff00");
    const s = scaleNearest(img, 2);
    expect([s.w, s.h]).toEqual([4, 2]);
    for (const y of [0, 1]) {
      expect(px(s, 0, y)).toEqual([255, 0, 0, 255]);
      expect(px(s, 1, y)).toEqual([255, 0, 0, 255]);
      expect(px(s, 2, y)).toEqual([0, 255, 0, 255]);
      expect(px(s, 3, y)).toEqual([0, 255, 0, 255]);
    }
  });
});
