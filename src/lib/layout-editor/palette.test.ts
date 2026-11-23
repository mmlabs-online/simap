import { describe, expect, it } from "vitest";
import { REGISTRY } from "@/lib/sprites/registry";
import { FIXTURE_GROUPS } from "@/lib/validate/layout";
import { fixturePalette, paletteEntries } from "./palette";

describe("paletteEntries", () => {
  const entries = paletteEntries();

  it("palette has desk.single as the only seat entry and only base keys of FIXTURE_GROUPS; no floor/chair/avatar/overlay", () => {
    expect(entries.filter((e) => e.kind === "seat").map((e) => e.sprite)).toEqual(["desk.single"]);
    expect(entries[0].sprite).toBe("desk.single");
    const fixtures = entries.filter((e) => e.kind === "fixture");
    expect(fixtures.length).toBeGreaterThan(0);
    for (const e of fixtures) expect(FIXTURE_GROUPS).toContain(e.group);
    const groups = new Set(entries.map((e) => e.group));
    for (const g of ["floor", "chair", "avatar", "state", "device"])
      expect(groups.has(g)).toBe(false);
    // every fixture-group sprite of the registry is reachable
    const expected = new Set(
      Object.entries(REGISTRY)
        .filter(([, v]) => FIXTURE_GROUPS.includes(v.group))
        .map(([k, v]) => (v.dir !== null ? k.slice(0, -2) : k)),
    );
    expect(new Set(fixtures.map((e) => e.sprite))).toEqual(expected);
  });

  it("directional entries are listed once by base key (door, cabinet.filing)", () => {
    for (const base of ["door", "cabinet.filing"]) {
      const hits = entries.filter((e) => e.sprite === base);
      expect(hits).toHaveLength(1);
      expect(hits[0].directional).toBe(true);
    }
    expect(entries.some((e) => /\.[nesw]$/.test(e.sprite) && REGISTRY[e.sprite]?.dir)).toBe(false);
    expect(new Set(entries.map((e) => e.sprite)).size).toBe(entries.length);
  });
});

describe("fixturePalette", () => {
  it("fixturePalette has no seat entries, groups in paletteEntries order, and the flattened entries equal the fixture entries of paletteEntries", () => {
    const groups = fixturePalette();
    const flat = groups.flatMap((g) => g.entries);
    expect(flat.some((e) => e.kind === "seat")).toBe(false);
    expect(flat).toEqual(paletteEntries().filter((e) => e.kind === "fixture"));
    expect(new Set(groups.map((g) => g.group)).size).toBe(groups.length);
    for (const g of groups) for (const e of g.entries) expect(e.group).toBe(g.group);
  });
});
