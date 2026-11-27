import { libraryItem } from "@/lib/map-items/library";
import { MAP_ITEM_DIRS, type MapItemDto } from "@/lib/map-items/types";
import { foldText } from "@/lib/search/fold";
import { atLeastTier, type Tier } from "@/lib/tier";
import { apiErrorMessage } from "../copy/api";
import { mapItemsCopy } from "../copy/mapItems";
import type { MapItemsResult } from "./map-items-api";
import { artDirs, isCustomised } from "./map-item-art";

/** Admins open the page (the API enforces it too). */
export function canManageMapItems(tier: Tier | null | undefined): boolean {
  return tier ? atLeastTier(tier, "admin") : false;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

/** Every item (hidden and all kinds) by group, groups and items in name order (D67 1; no reorder). */
export function catalogGroups(
  items: readonly MapItemDto[],
): { group: string; items: MapItemDto[] }[] {
  const groups = new Map<string, MapItemDto[]>();
  for (const i of items) groups.set(i.group, [...(groups.get(i.group) ?? []), i]);
  return [...groups.entries()]
    .sort(([a], [b]) => byName(a, b) || cmp(a, b))
    .map(([group, rows]) => ({
      group,
      items: rows.sort((a, b) => byName(a.name, b.name) || cmp(a.builtinKey, b.builtinKey)),
    }));
}

/** True when a reset would change nothing (also for a key without library defaults). */
export function isLibraryDefault(item: MapItemDto): boolean {
  const lib = libraryItem(item.builtinKey);
  if (!lib) return true;
  return (
    item.name === lib.name &&
    item.group === lib.group &&
    item.w === lib.w &&
    item.h === lib.h &&
    !item.hidden &&
    MAP_ITEM_DIRS.every((d) => item.art[d].sprite === null && !item.art[d].hasImage)
  );
}

export function mapItemErrorMessage(code: string, rooms?: number): string {
  return code === "item_in_use" && rooms !== undefined
    ? mapItemsCopy.errors.inUse(rooms)
    : apiErrorMessage(code);
}

export type Settled = { kind: "done" } | { kind: "error"; message: string };

/** After a save or reset: done, or the inline message. An item that is already gone counts as done (the list reloads). */
export function settleMapItem(result: MapItemsResult<unknown>): Settled {
  if (result.ok || result.code === "not_found") return { kind: "done" };
  return { kind: "error", message: mapItemErrorMessage(result.code, result.rooms) };
}

export type ArtSource = "image" | "sprite" | "library";

/** The art a card shows: custom image, then package sprite, then the library frame, over the allowed directions. */
export function artSourceOf(item: MapItemDto): ArtSource {
  const dirs = artDirs(item);
  if (dirs.some((d) => item.art[d].hasImage)) return "image";
  if (dirs.some((d) => item.art[d].sprite !== null)) return "sprite";
  return "library";
}

export function mapItemStats(items: readonly MapItemDto[]): {
  total: number;
  inPalette: number;
  customised: number;
} {
  return {
    total: items.length,
    inPalette: items.filter((i) => !i.hidden).length,
    customised: items.filter(isCustomised).length,
  };
}

/** Items in catalog order, narrowed by group and by a case- and diacritic-insensitive search of name or key. */
export function filterItems(
  items: readonly MapItemDto[],
  group: string | null,
  query: string,
): MapItemDto[] {
  const q = foldText(query.trim());
  return catalogGroups(items)
    .flatMap((g) => g.items)
    .filter((i) => group === null || i.group === group)
    .filter((i) => q === "" || foldText(i.name).includes(q) || foldText(i.builtinKey).includes(q));
}

/** The selected group, or null (All) when nothing is selected or the group has left the list. */
export function activeGroup(groups: readonly string[], selected: string | null): string | null {
  return selected !== null && groups.includes(selected) ? selected : null;
}
