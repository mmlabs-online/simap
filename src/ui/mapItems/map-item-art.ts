import { sizeFor, spriteAllowedFor, spriteFits } from "@/lib/map-items/art";
import { MAP_ITEM_DIRS, MAP_ITEM_LIMITS, type MapItemDto } from "@/lib/map-items/types";
import { FRAME_KEYS, REGISTRY } from "@/lib/sprites/registry";
import { itemImageId } from "@/lib/sprites/item-art";
import type { Direction } from "@/lib/sprites/types";
import type { ImageEntry } from "../deviceTypes/image-url-cache";

/** Directions an item has art for: n/e/s/w when directional, else `s` only (images are never rotated). */
export const artDirs = (item: Pick<MapItemDto, "directional">): readonly Direction[] =>
  item.directional ? MAP_ITEM_DIRS : ["s"];

export type ArtPanelView = {
  source: "image" | "sprite" | "library";
  spriteKey: string | null;
  /** A sprite is chosen but the custom image wins. */
  spriteHidden: boolean;
  canRemove: boolean;
  canUseLibrary: boolean;
};

/** Which art shows for a direction: custom image, then chosen sprite, then the library frame (spec "Art per item"). */
export function artPanelView(item: MapItemDto, dir: Direction): ArtPanelView {
  const { sprite, hasImage } = item.art[dir];
  return {
    source: hasImage ? "image" : sprite ? "sprite" : "library",
    spriteKey: sprite,
    spriteHidden: hasImage && sprite !== null,
    canRemove: hasImage,
    canUseLibrary: sprite !== null,
  };
}

/** The pixel size a custom image must have for a direction: width exact, height between `hMin` and `hMax`. */
export function expectedImageSize(
  item: Pick<MapItemDto, "kind" | "w" | "h">,
  dir: Direction,
): { w: number; hMin: number; hMax: number } {
  const { tilePx, overhangPx } = MAP_ITEM_LIMITS;
  if (item.kind === "floor") return { w: tilePx, hMin: tilePx, hMax: tilePx };
  const [tw, th] = sizeFor(dir, item.w, item.h);
  return { w: tilePx * tw, hMin: tilePx * th, hMax: tilePx * th + overhangPx };
}

/** Package frames the item may use for a direction, by registry group (group names sorted, keys sorted). */
export function spriteChoices(
  item: MapItemDto,
  dir: Direction,
): { group: string; keys: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const k of FRAME_KEYS) {
    if (!spriteAllowedFor(item, k) || !spriteFits(k, dir, item.w, item.h)) continue;
    const g = REGISTRY[k]!.group;
    groups.set(g, [...(groups.get(g) ?? []), k]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([group, keys]) => ({ group, keys }));
}

/** Image cache entries for every direction an item allows. */
export const artImageEntries = (items: readonly MapItemDto[]): ImageEntry[] =>
  items.flatMap((item) =>
    artDirs(item).map((dir) => ({
      id: itemImageId(item.builtinKey, dir),
      hasImage: item.art[dir].hasImage,
      imageVersion: item.art[dir].imageVersion,
    })),
  );

/** Any allowed direction has a custom image or a chosen sprite. */
export const isCustomised = (item: MapItemDto): boolean =>
  artDirs(item).some((d) => item.art[d].hasImage || item.art[d].sprite !== null);

/** The direction the row thumbnail shows: `s` first, then n, e, w; null when no allowed direction has an image. */
export function thumbDir(item: MapItemDto): Direction | null {
  const order: Direction[] = ["s", "n", "e", "w"];
  return order.find((d) => artDirs(item).includes(d) && item.art[d].hasImage) ?? null;
}

/** The item an open art dialog shows, or undefined once it has left the list. */
export function findArtItem(items: MapItemDto[], key: string): MapItemDto | undefined {
  return items.find((i) => i.builtinKey === key);
}
