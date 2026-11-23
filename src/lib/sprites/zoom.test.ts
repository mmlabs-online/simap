import { describe, expect, it } from "vitest";
import { allowedZooms, clampZoom, fitsCanvas } from "./zoom";

describe("allowedZooms", () => {
  it("a 20 x 15 tile room allows 2, 3 and 4", () => {
    expect(allowedZooms({ w: 20 * 32, h: 15 * 32 })).toEqual([2, 3, 4]);
  });
  it("2048 x 2048 px allows only 2 (exactly at the area cap); 2048 x 2049 allows none", () => {
    expect(allowedZooms({ w: 2048, h: 2048 })).toEqual([2]);
    expect(allowedZooms({ w: 2048, h: 2049 })).toEqual([]);
  });
  it("a 2048 x 32 px strip is limited by the side cap", () => {
    expect(allowedZooms({ w: 2048, h: 32 })).toEqual([2, 3, 4]);
    expect(fitsCanvas(8192, 128)).toBe(true);
    expect(fitsCanvas(2049 * 4, 128)).toBe(false);
    expect(allowedZooms({ w: 2049, h: 32 })).toEqual([2, 3]);
  });
});

describe("clampZoom", () => {
  it("keeps an allowed level, drops to the largest allowed below it, null for none", () => {
    expect(clampZoom(3, [2, 3, 4])).toBe(3);
    expect(clampZoom(4, [2, 3])).toBe(3);
    expect(clampZoom(4, [2])).toBe(2);
    expect(clampZoom(2, [])).toBeNull();
  });
});
