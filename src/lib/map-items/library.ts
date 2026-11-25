import { REGISTRY } from "@/lib/sprites/registry";
import { FIXTURE_GROUPS, SEAT_SPRITES, footprintOf, spriteInfo } from "@/lib/validate/layout";
import type { MapItemKind } from "./types";

export type LibraryItem = {
  builtinKey: string;
  name: string;
  group: string;
  w: number;
  h: number;
  kind: MapItemKind;
  directional: boolean;
  fixedSize: boolean;
};

const CHAIR_ITEMS: readonly string[] = ["chair.office"];

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The readable default name: the key with `.` and `_` as spaces ("wall t s", "window double"). */
export const mapItemName = (key: string): string => key.replace(/[._]/g, " ");

function build(): readonly LibraryItem[] {
  const bases = new Set<string>();
  for (const [key, entry] of Object.entries(REGISTRY)) {
    bases.add(entry.dir !== null ? key.slice(0, -2) : key);
  }
  const make = (builtinKey: string, kind: MapItemKind): LibraryItem | null => {
    const info = spriteInfo(builtinKey);
    if (!info) return null;
    const [w, h] = footprintOf(builtinKey, 0) ?? [1, 1];
    return {
      builtinKey,
      name: mapItemName(builtinKey),
      group: info.group,
      w,
      h,
      kind,
      directional: info.directional,
      fixedSize: kind !== "fixture",
    };
  };
  const pick = (
    keys: Iterable<string>,
    kind: MapItemKind,
    ok: (g: string, d: boolean) => boolean,
  ) => {
    const out: LibraryItem[] = [];
    for (const key of keys) {
      const info = spriteInfo(key);
      if (!info || !ok(info.group, info.directional)) continue;
      const item = make(key, kind);
      if (item) out.push(item);
    }
    return out.sort((a, b) => cmp(a.group, b.group) || cmp(a.builtinKey, b.builtinKey));
  };
  const seats = SEAT_SPRITES.map((k) => make(k, "seat")).filter(
    (i): i is LibraryItem => i !== null,
  );
  const fixtures = pick(bases, "fixture", (g) => FIXTURE_GROUPS.includes(g));
  const floors = pick(bases, "floor", (g, d) => g === "floor" && !d);
  const chairs = CHAIR_ITEMS.map((k) => make(k, "chair")).filter(
    (i): i is LibraryItem => i !== null,
  );
  return Object.freeze([...seats, ...fixtures, ...floors, ...chairs]);
}

/** One entry per library item every org's catalog is seeded with (D66.1, LAY-03): desk, fixtures, floors, chair. */
export const LIBRARY_ITEMS: readonly LibraryItem[] = build();

const BY_KEY: ReadonlyMap<string, LibraryItem> = new Map(
  LIBRARY_ITEMS.map((i) => [i.builtinKey, i]),
);

/** The library defaults of a base key, or null when it is not a catalog item. */
export const libraryItem = (key: string): LibraryItem | null => BY_KEY.get(key) ?? null;
