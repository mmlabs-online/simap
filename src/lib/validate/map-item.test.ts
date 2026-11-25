import { describe, expect, it } from "vitest";
import { artDir, isMapItemKey, validateMapItemArt, validateMapItemPatch } from "./map-item";

const patch = (b: unknown) => validateMapItemPatch(b);

describe("map item validators", () => {
  it('isMapItemKey: accepts desk.single, wall.t.s; refuses "", "Door", "a..b", ".a", 101 chars, "../x"', () => {
    expect(isMapItemKey("desk.single")).toBe(true);
    expect(isMapItemKey("wall.t.s")).toBe(true);
    for (const s of ["", "Door", "a..b", ".a", "a".repeat(101), "../x"]) {
      expect(isMapItemKey(s)).toBe(false);
    }
    expect(isMapItemKey("a".repeat(100))).toBe(true);
  });

  it("artDir: n/e/s/w only", () => {
    for (const d of ["n", "e", "s", "w"]) expect(artDir(d)).toBe(d);
    for (const d of ["", "N", "x", "ne"]) expect(artDir(d)).toBeNull();
  });

  it('patch: name/group NFC + whitespace collapse + trim ("  Bàn \\t làm  việc " -> "Bàn làm việc"); 60/40 code-point limits with Vietnamese diacritics; blank, control and format chars refused', () => {
    expect(patch({ name: "  Bàn \t làm  việc " })).toEqual({
      ok: true,
      value: { name: "Bàn làm việc" },
    });
    // decomposed input is normalised to NFC
    const nfd = "Bàn";
    expect(patch({ group: nfd })).toEqual({ ok: true, value: { group: "Bàn" } });
    expect(patch({ name: "ệ".repeat(60) }).ok).toBe(true);
    expect(patch({ name: "ệ".repeat(61) })).toEqual({ ok: false, field: "name" });
    expect(patch({ group: "Ư".repeat(40) }).ok).toBe(true);
    expect(patch({ group: "Ư".repeat(41) })).toEqual({ ok: false, field: "group" });
    for (const bad of ["", "   ", "a\u0000b", "a​b", 5, null]) {
      expect(patch({ name: bad })).toEqual({ ok: false, field: "name" });
    }
  });

  it('patch: w/h integers 1..4 only (0, 5, 1.5, "2", null refused); hidden boolean only', () => {
    expect(patch({ w: 1, h: 4, hidden: true })).toEqual({
      ok: true,
      value: { w: 1, h: 4, hidden: true },
    });
    for (const bad of [0, 5, 1.5, "2", null]) {
      expect(patch({ w: bad })).toEqual({ ok: false, field: "w" });
      expect(patch({ h: bad })).toEqual({ ok: false, field: "h" });
    }
    for (const bad of [1, "true", null]) {
      expect(patch({ hidden: bad })).toEqual({ ok: false, field: "hidden" });
    }
  });

  it('patch: non-object, empty {}, extra key (e.g. "order", "builtinKey") -> field', () => {
    expect(patch(null)).toEqual({ ok: false, field: "body" });
    expect(patch([])).toEqual({ ok: false, field: "body" });
    expect(patch({})).toEqual({ ok: false, field: "body" });
    expect(patch({ name: "x", order: 1 })).toEqual({ ok: false, field: "order" });
    expect(patch({ builtinKey: "door" })).toEqual({ ok: false, field: "builtinKey" });
  });

  it('art: { sprite: null } ok; { sprite: "plant.small" } ok; unknown frame, "door" (base key of a directional item, not a frame key), bad format, missing sprite, extra key -> invalid', () => {
    expect(validateMapItemArt({ sprite: null })).toEqual({ ok: true, value: { sprite: null } });
    expect(validateMapItemArt({ sprite: "plant.small" })).toEqual({
      ok: true,
      value: { sprite: "plant.small" },
    });
    for (const sprite of ["no.such.frame", "door", "../x", "", 5]) {
      expect(validateMapItemArt({ sprite })).toEqual({ ok: false, field: "sprite" });
    }
    expect(validateMapItemArt({})).toEqual({ ok: false, field: "sprite" });
    expect(validateMapItemArt({ sprite: null, extra: 1 })).toEqual({ ok: false, field: "extra" });
    expect(validateMapItemArt("x")).toEqual({ ok: false, field: "body" });
  });
});
