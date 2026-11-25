import { describe, expect, it } from "vitest";
import { REGISTRY } from "@/lib/sprites/registry";
import { FIXTURE_GROUPS } from "@/lib/validate/layout";
import type { MapItemDto } from "@/lib/map-items/types";
import { catalogPalette, paletteEntries } from "./palette";

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

const art = { sprite: null, hasImage: false, imageVersion: 0 };
const row = (builtinKey: string, name: string, group: string, over: Partial<MapItemDto> = {}) =>
  ({
    builtinKey,
    name,
    group,
    w: 1,
    h: 1,
    hidden: false,
    kind: "fixture",
    directional: false,
    fixedSize: false,
    art: { n: art, e: art, s: art, w: art },
    ...over,
  }) as MapItemDto;

describe("catalogPalette", () => {
  it("keeps kind seat and fixture only and drops hidden rows", () => {
    const groups = catalogPalette([
      row("desk.single", "Desk", "Desks", { kind: "seat", fixedSize: true }),
      row("floor.wood", "Wood", "Floors", { kind: "floor" }),
      row("chair.office", "Chair", "Chairs", { kind: "chair" }),
      row("prop.mug", "Mug", "Props", { hidden: true }),
      row("desk.l", "L desk", "Desks", { kind: "seat", hidden: true }),
      row("plant.large", "Plant", "Props"),
    ]);
    expect(groups.flatMap((g) => g.entries.map((e) => e.sprite))).toEqual([
      "desk.single",
      "plant.large",
    ]);
  });

  it("sorts groups and entries by name, case and accent insensitive, then by exact text and key, whatever the input order", () => {
    const rows = [
      row("k3", "ban", "Bàn"),
      row("k2", "Bàn", "Bàn"),
      row("k1", "Cây", "Bàn"),
      row("k0", "Ánh", "Bàn"),
      row("k4", "x", "ban"),
    ];
    const names = (r: MapItemDto[]) =>
      catalogPalette(r).map((g) => [g.group, g.entries.map((e) => e.sprite)]);
    expect(names(rows)).toEqual([
      ["Bàn", ["k0", "k2", "k3", "k1"]],
      ["ban", ["k4"]],
    ]);
    expect(names([...rows].reverse())).toEqual(names(rows));
  });

  it("groups by the exact group string; an empty list gives []", () => {
    expect(catalogPalette([])).toEqual([]);
    const g = catalogPalette([
      row("a", "A", "Decor"),
      row("b", "B", "Decor "),
      row("c", "C", "Decor"),
    ]);
    expect(g.map((x) => [x.group, x.entries.length])).toEqual([
      ["Decor", 2],
      ["Decor ", 1],
    ]);
  });

  it("an entry carries name, kind and directional from the DTO; desk.single is a seat entry", () => {
    const [g] = catalogPalette([
      row("desk.single", "Bàn đơn", "Desks", { kind: "seat", directional: true }),
    ]);
    expect(g.entries[0]).toEqual({
      sprite: "desk.single",
      name: "Bàn đơn",
      kind: "seat",
      group: "Desks",
      directional: true,
    });
  });
});
