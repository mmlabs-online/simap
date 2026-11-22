import { describe, expect, it } from "vitest";
import {
  HAIR_RAMP,
  SHIRT_RAMP,
  SKIN_RAMP,
  avatarFor,
  avatarFrames,
  avatarView,
  fnv1a,
} from "./avatar";

describe("fnv1a", () => {
  it("known FNV-1a vectors", () => {
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
    expect(fnv1a("foobar")).toBe(0xbf9cf968);
  });

  it("hashes UTF-8: Vietnamese diacritics work, NFC and NFD differ only as raw input", () => {
    const nfc = "Nguyễn Thị Ánh".normalize("NFC");
    const nfd = nfc.normalize("NFD");
    expect(nfc).not.toBe(nfd);
    expect(fnv1a(nfc)).not.toBe(fnv1a(nfd));
    expect(fnv1a(nfc)).toBe(fnv1a("Nguyễn Thị Ánh".normalize("NFC")));
    // "é" is the two UTF-8 bytes c3 a9.
    let h = 0x811c9dc5;
    for (const b of [0xc3, 0xa9]) h = Math.imul(h ^ b, 0x01000193) >>> 0;
    expect(fnv1a("é")).toBe(h);
  });
});

describe("avatarFor", () => {
  it("is stable", () => {
    expect(avatarFor("sub-123")).toEqual(avatarFor("sub-123"));
  });

  it("ramps are salted", () => {
    const sub = "sub-123";
    const hashes = [":skin", ":hair", ":shirt", ":style"].map((s) => fnv1a(sub + s));
    expect(new Set(hashes).size).toBe(4);
  });

  it("picks colours from the style guide ramps and a hair style of 1 to 3", () => {
    for (const sub of ["a", "b", "c", "Nguyễn", "x".repeat(50)]) {
      const look = avatarFor(sub);
      expect(SKIN_RAMP).toContain(look.skin);
      expect(HAIR_RAMP).toContain(look.hair);
      expect(SHIRT_RAMP).toContain(look.shirt);
      expect([1, 2, 3]).toContain(look.style);
    }
  });

  it("empty sub returns valid ramp colours", () => {
    const look = avatarFor("");
    expect(SKIN_RAMP).toContain(look.skin);
    expect(HAIR_RAMP).toContain(look.hair);
    expect(SHIRT_RAMP).toContain(look.shirt);
  });
});

describe("avatar frames", () => {
  it("view is back on a .n chair and front otherwise", () => {
    expect(avatarView("chair.office.n")).toBe("back");
    expect(avatarView("chair.office.s")).toBe("front");
    expect(avatarView("chair.office.e")).toBe("front");
  });

  it("paints body, shirt, hair in that order", () => {
    const look = { skin: "#1", hair: "#2", shirt: "#3", style: 2 as const };
    expect(avatarFrames(look, "back")).toEqual([
      { key: "avatar.body.back", tint: "#1" },
      { key: "avatar.shirt.back", tint: "#3" },
      { key: "avatar.hair.2.back", tint: "#2" },
    ]);
  });
});
