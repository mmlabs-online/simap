import { REGISTRY } from "@/lib/sprites/registry";
import { FIXTURE_GROUPS, SEAT_SPRITES, spriteInfo } from "@/lib/validate/layout";

export type PaletteEntry = {
  sprite: string;
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
    if (info) seats.push({ sprite, kind: "seat", ...info });
  }
  const bases = new Set<string>();
  for (const [key, entry] of Object.entries(REGISTRY)) {
    bases.add(entry.dir !== null ? key.slice(0, -2) : key);
  }
  const fixtures: PaletteEntry[] = [];
  for (const sprite of bases) {
    const info = spriteInfo(sprite);
    if (info && FIXTURE_GROUPS.includes(info.group)) {
      fixtures.push({ sprite, kind: "fixture", ...info });
    }
  }
  fixtures.sort((a, b) => cmp(a.group, b.group) || cmp(a.sprite, b.sprite));
  return [...seats, ...fixtures];
}

/** All entries grouped in palette order: the desk group first, then the fixture groups. */
export function editorPalette(): { group: string; entries: PaletteEntry[] }[] {
  const groups: { group: string; entries: PaletteEntry[] }[] = [];
  for (const e of paletteEntries()) {
    const last = groups[groups.length - 1];
    if (last && last.group === e.group) last.entries.push(e);
    else groups.push({ group: e.group, entries: [e] });
  }
  return groups;
}
