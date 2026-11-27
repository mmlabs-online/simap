import { describe, expect, it } from "vitest";
import { contrastRatio, isOpaque, mixSrgb, parseHex } from "./contrast";

describe("parseHex", () => {
  it("parses #rgb, #rrggbb, #rrggbbaa (alpha ignored; isOpaque rejects alpha)", () => {
    expect(parseHex("#fa0")).toEqual([255, 170, 0]);
    expect(parseHex("#ED5B35")).toEqual([237, 91, 53]);
    expect(parseHex("#ED5B3580")).toEqual([237, 91, 53]);
    expect(isOpaque("#fa0")).toBe(true);
    expect(isOpaque("#ED5B35")).toBe(true);
    expect(isOpaque("#ED5B3580")).toBe(false);
    expect(() => parseHex("red")).toThrow();
  });
});

describe("contrastRatio", () => {
  it("white/black is 21, same colour is 1, order-independent", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
    expect(contrastRatio("#ED5B35", "#272931")).toBeCloseTo(
      contrastRatio("#272931", "#ED5B35"),
      10,
    );
  });

  it("pins the Q1 numbers", () => {
    expect(contrastRatio("#ffffff", "#ED5B35")).toBeCloseTo(3.41, 1);
    expect(contrastRatio("#ffffff", "#D3441F")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#272931", "#ED5B35")).toBeCloseTo(4.25, 1);
  });
});

describe("mixSrgb", () => {
  it("matches CSS color-mix(in srgb) per channel, rounded", () => {
    // 8% of #B44C46 over white: 255 - 0.08 * (255 - c) per channel
    expect(mixSrgb("#B44C46", "#FFFFFF", 0.08)).toBe("#f9f1f0");
    expect(mixSrgb("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});
