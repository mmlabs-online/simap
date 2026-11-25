import type { MapItemDto } from "@/lib/map-items/types";
import { REGISTRY } from "@/lib/sprites/registry";
import { FIXTURE_GROUPS, SEAT_SPRITES, spriteInfo } from "@/lib/validate/layout";

export type PaletteEntry = {
  sprite: string;
  /** Catalog name (the key for registry-derived entries). */
  name: string;
  kind: "seat" | "fixture";
  group: string;
  directional: boolean;
};

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Seat sprites first, then base fixture keys by group and key; a directional sprite is listed once. */
export function paletteEntries(): PaletteEntry[] {
  const seats: PaletteEntry[] = [];
  for (const sprite of SEAT_SPRITES) {
    const info = spriteInfo(sprite);
    if (info) seats.push({ sprite, name: sprite, kind: "seat", ...info });
  }
  const bases = new Set<string>();
  for (const [key, entry] of Object.entries(REGISTRY)) {
    bases.add(entry.dir !== null ? key.slice(0, -2) : key);
  }
  const fixtures: PaletteEntry[] = [];
  for (const sprite of bases) {
    const info = spriteInfo(sprite);
    if (info && FIXTURE_GROUPS.includes(info.group)) {
      fixtures.push({ sprite, name: sprite, kind: "fixture", ...info });
    }
  }
  fixtures.sort((a, b) => cmp(a.group, b.group) || cmp(a.sprite, b.sprite));
  return [...seats, ...fixtures];
}

const byName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

/** The org's "Add items" palette: seat and fixture rows that are not hidden, groups and entries by name (D67 1). */
export function catalogPalette(
  items: readonly MapItemDto[],
): { group: string; entries: PaletteEntry[] }[] {
  const groups = new Map<string, MapItemDto[]>();
  for (const i of items) {
    if ((i.kind !== "seat" && i.kind !== "fixture") || i.hidden) continue;
    groups.set(i.group, [...(groups.get(i.group) ?? []), i]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => byName(a, b) || cmp(a, b))
    .map(([group, rows]) => ({
      group,
      entries: rows
        .sort((a, b) => byName(a.name, b.name) || cmp(a.builtinKey, b.builtinKey))
        .map((i) => ({
          sprite: i.builtinKey,
          name: i.name,
          kind: i.kind as "seat" | "fixture",
          group: i.group,
          directional: i.directional,
        })),
    }));
}
