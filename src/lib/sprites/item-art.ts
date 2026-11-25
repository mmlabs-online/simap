import { MAP_ITEM_LIMITS } from "@/lib/map-items/types";
import type { LayoutItem, RoomLayout, Rotation } from "./layout";
import type { Direction, SpriteFrame } from "./types";

// Import rule: this file must never import `@/lib/map-items/art` or `library` or `./placement`
// (cycle: library -> validate/layout -> placement -> item-art).

/** Same table as `ROTATION_TO_DIR` in `placement.ts` (a test asserts equality; no import to avoid a cycle). */
const ROTATION_DIR: Record<Rotation, Direction> = { 0: "s", 90: "e", 180: "n", 270: "w" };
const OPPOSITE: Record<Direction, Direction> = { s: "n", n: "s", e: "w", w: "e" };

/** The natural size of a decoded custom image, in pixels. */
export type ItemImageSize = { w: number; h: number };

/** One custom image a layout needs: a placed `{key, dir}` whose art has an image. */
export type ItemArtEntry = {
  id: string;
  key: string;
  dir: Direction;
  hasImage: true;
  imageVersion: number;
};

export type ItemArt =
  | { type: "image"; src: string; version: number; w: number; h: number }
  | { type: "frame"; key: string; library: boolean }
  | { type: "placeholder" };

export const itemImageId = (key: string, dir: Direction): string => `item:${key}|${dir}`;

/** The `{key, dir}` of an item image id; null for anything else (device type ids are uuids). */
export function parseItemImageId(id: string): { key: string; dir: Direction } | null {
  if (!id.startsWith("item:")) return null;
  const at = id.lastIndexOf("|");
  const dir = id.slice(at + 1);
  if (at < 0 || !(dir === "n" || dir === "e" || dir === "s" || dir === "w")) return null;
  return { key: id.slice(5, at), dir };
}

type ArtItem = Pick<LayoutItem, "kind" | "directional" | "w" | "h" | "art" | "builtinKey">;

/** The art direction a placed item shows: floors and non-directional items use `s`. */
export const itemArtDir = (item: Pick<ArtItem, "kind" | "directional">, rotation: Rotation) =>
  item.kind === "floor" || !item.directional ? "s" : ROTATION_DIR[rotation];

/** The item's footprint in tiles at a rotation (90/270 swap, LAY-01). */
export const itemBox = (item: Pick<ArtItem, "w" | "h">, rotation: Rotation): [number, number] =>
  rotation === 90 || rotation === 270 ? [item.h, item.w] : [item.w, item.h];

/** D66 7: 32 px per tile in width, per tile up to 32 px taller in height; floors exactly 32 x 32. */
export function imageFits(
  item: Pick<ArtItem, "kind">,
  box: readonly [number, number],
  size: ItemImageSize,
): boolean {
  const { tilePx, overhangPx } = MAP_ITEM_LIMITS;
  if (item.kind === "floor") return size.w === tilePx && size.h === tilePx;
  return (
    size.w === tilePx * box[0] &&
    size.h >= tilePx * box[1] &&
    size.h <= tilePx * box[1] + overhangPx
  );
}

/** Custom image, then chosen package sprite, then the library frame, then the placeholder (spec "Art per item"). */
export function resolveItemArt(p: {
  item: ArtItem;
  dir: Direction;
  box: readonly [number, number];
  libraryKey: string;
  frames: Readonly<Record<string, SpriteFrame>>;
  image: (key: string, dir: Direction, version: number) => ItemImageSize | null;
  unknown: string[];
}): ItemArt {
  const art = p.item.art[p.dir];
  if (art.hasImage) {
    const size = p.image(p.item.builtinKey, p.dir, art.imageVersion);
    if (size && imageFits(p.item, p.box, size)) {
      return {
        type: "image",
        src: itemImageId(p.item.builtinKey, p.dir),
        version: art.imageVersion,
        w: size.w,
        h: size.h,
      };
    }
  }
  if (art.sprite) {
    if (p.frames[art.sprite]) return { type: "frame", key: art.sprite, library: false };
    p.unknown.push(art.sprite);
  }
  if (p.frames[p.libraryKey]) return { type: "frame", key: p.libraryKey, library: true };
  p.unknown.push(p.libraryKey);
  return { type: "placeholder" };
}

/** The images a layout needs: only placed directions with an image, deduplicated. */
export function placedArtEntries(layout: RoomLayout, items: readonly LayoutItem[]): ItemArtEntry[] {
  const byKey = new Map(items.map((i) => [i.builtinKey, i]));
  const out = new Map<string, ItemArtEntry>();
  const add = (key: string, dir: Direction) => {
    const art = byKey.get(key)?.art[dir];
    if (!art?.hasImage) return;
    const id = itemImageId(key, dir);
    out.set(id, { id, key, dir, hasImage: true, imageVersion: art.imageVersion });
  };
  for (const zone of layout.floors) add(zone.sprite, "s");
  for (const fx of layout.fixtures) {
    const row = byKey.get(fx.sprite);
    if (row) add(fx.sprite, itemArtDir(row, fx.rotation));
  }
  for (const seat of layout.seats) {
    const row = byKey.get(seat.sprite);
    if (row) add(seat.sprite, itemArtDir(row, seat.rotation));
    add("chair.office", OPPOSITE[ROTATION_DIR[seat.rotation]]);
  }
  return [...out.values()];
}
