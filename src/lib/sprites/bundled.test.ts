import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bundledKeys } from "./bundled";

describe("bundledKeys", () => {
  it("returns map and export keys, not placeholder", () => {
    const set = bundledKeys({ meta: { sources: { a: "map", b: "placeholder", c: "export" } } });
    expect([...set!].sort()).toEqual(["a", "c"]);
  });

  it("null when meta, meta.sources missing or not an object; ignores non-string values", () => {
    expect(bundledKeys(null)).toBeNull();
    expect(bundledKeys(undefined)).toBeNull();
    expect(bundledKeys({})).toBeNull();
    expect(bundledKeys({ meta: null })).toBeNull();
    expect(bundledKeys({ meta: "x" })).toBeNull();
    expect(bundledKeys({ meta: {} })).toBeNull();
    expect(bundledKeys({ meta: { sources: null } })).toBeNull();
    expect(bundledKeys({ meta: { sources: "map" } })).toBeNull();
    expect([...bundledKeys({ meta: { sources: { a: 1, b: null, c: "map" } } })!]).toEqual(["c"]);
  });

  it("committed office.json: the set equals the sprite-map keys (55)", () => {
    const json = JSON.parse(readFileSync("public/sprites/office.json", "utf8"));
    const map = JSON.parse(readFileSync("assets/art/sprite-map.json", "utf8"));
    const set = bundledKeys(json)!;
    expect([...set].sort()).toEqual(Object.keys(map.sprites).sort());
    expect(set.size).toBe(55);
  });
});
