import { libraryItem } from "@/lib/map-items/library";
import { MAP_ITEM_DIRS, type MapItemDto } from "@/lib/map-items/types";
import { atLeastTier, type Tier } from "@/lib/tier";
import { apiErrorMessage } from "../copy/api";
import { mapItemsCopy } from "../copy/mapItems";
import type { MapItemsResult } from "./map-items-api";

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
