import { describe, expect, it } from "vitest";
import { avatarFor, HAIR_RAMP, SHIRT_RAMP, SKIN_RAMP } from "./avatar";
import {
  derivedChoice,
  isPixelLook,
  lookFromChoice,
  parsePixelLook,
  resolveLook,
} from "./pixel-look";

const OK = { skin: 1, hair: 2, style: 3, shirt: 4 } as const;

describe("pixel look", () => {
  it("ramps are pinned (members_pixel_look_check depends on these lengths and order)", () => {
    expect(SKIN_RAMP).toEqual(["#f6d0b1", "#e8b48f", "#c98e66", "#8d5a3b"]);
    expect(HAIR_RAMP).toEqual(["#2b2118", "#5a3a22", "#b07a3a", "#1f2a44", "#a33b3b", "#3b2b4a"]);
    expect(SHIRT_RAMP).toEqual([
      "#e05d5d",
      "#3a7bd5",
      "#2fa36b",
      "#8e5bd6",
      "#f0a03c",
      "#3fb5b0",
      "#5a6b8c",
    ]);
    expect([SKIN_RAMP.length, HAIR_RAMP.length, SHIRT_RAMP.length]).toEqual([4, 6, 7]);
  });

  it("isPixelLook accepts every boundary", () => {
    for (const skin of [0, 3]) {
      for (const hair of [0, 5]) {
        for (const style of [1, 3]) {
          for (const shirt of [0, 6]) expect(isPixelLook({ skin, hair, style, shirt })).toBe(true);
        }
      }
    }
  });

  it("isPixelLook rejects missing key, extra key, float, string number, negative, out of range, NaN, null, array", () => {
    const bad: unknown[] = [
      {},
      { skin: 1, hair: 2, style: 3 },
      { ...OK, extra: 1 },
      { ...OK, skin: 1.5 },
      { ...OK, skin: "1" },
      { ...OK, skin: -1 },
      { ...OK, skin: 4 },
      { ...OK, hair: 6 },
      { ...OK, shirt: 7 },
      { ...OK, style: 0 },
      { ...OK, style: 4 },
      { ...OK, hair: Number.NaN },
      { ...OK, hair: Number.POSITIVE_INFINITY },
      null,
      undefined,
      [],
      [1, 2, 3, 4],
      "x",
      3,
    ];
    for (const v of bad) expect(isPixelLook(v), JSON.stringify(v)).toBe(false);
  });

  it("parsePixelLook returns a copy of a valid look and null otherwise", () => {
    expect(parsePixelLook(OK)).toEqual(OK);
    expect(parsePixelLook(OK)).not.toBe(OK);
    expect(parsePixelLook({ ...OK, skin: 9 })).toBeNull();
  });

  it("lookFromChoice maps indices to the ramp hex and keeps style", () => {
    expect(lookFromChoice(OK)).toEqual({
      skin: SKIN_RAMP[1],
      hair: HAIR_RAMP[2],
      shirt: SHIRT_RAMP[4],
      style: 3,
    });
  });

  it("resolveLook: stored maps; null, undefined, garbage and out-of-range fall back to avatarFor(seed)", () => {
    expect(resolveLook(OK, "seed")).toEqual(lookFromChoice(OK));
    for (const v of [null, undefined, "x", { ...OK, skin: 4 }, {}]) {
      expect(resolveLook(v, "seed")).toEqual(avatarFor("seed"));
    }
  });

  it("derivedChoice(seed) maps back to avatarFor(seed) for 200 seeds incl. empty and Vietnamese text", () => {
    const seeds = [
      "",
      "Nguyễn Thị Ánh",
      "Trần Bảo",
      ...Array.from({ length: 197 }, (_, i) => `s-${i}`),
    ];
    expect(seeds).toHaveLength(200);
    for (const s of seeds) {
      const c = derivedChoice(s);
      expect(isPixelLook(c), s).toBe(true);
      expect(lookFromChoice(c), s).toEqual(avatarFor(s));
    }
  });
});
