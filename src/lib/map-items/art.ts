import { REGISTRY, isFrameKey } from "@/lib/sprites/registry";
import { allowedDirs } from "@/lib/sprites/rotations";
import type { Direction } from "@/lib/sprites/types";
import { LIBRARY_ITEMS, type LibraryItem } from "./library";
import { MAP_ITEM_LIMITS } from "./types";

/** Frame groups a catalog item may wear: the groups of the library items (never avatar, device or state frames). */
const ALLOWED_GROUPS: ReadonlySet<string> = new Set(LIBRARY_ITEMS.map((i) => i.group));

/** The item's tiles for a direction: rotation-0 size, swapped for e/w (D66.7). */
export const sizeFor = (dir: Direction, w: number, h: number): [number, number] =>
  dir === "e" || dir === "w" ? [h, w] : [w, h];

/** Tiles of a package frame; frames without a footprint are 1 x 1. */
export const frameTiles = (frameKey: string): [number, number] =>
  REGISTRY[frameKey]?.tiles ?? [1, 1];

/** A non-directional item uses `s` only; clock.wall and screen.projector use `n` and `s` (SIM-049). */
export const artDirAllowed = (
  item: Pick<LibraryItem, "directional" | "builtinKey">,
  dir: Direction,
): boolean => (item.directional ? allowedDirs(item.builtinKey).includes(dir) : dir === "s");

/** Group and layer rule: a catalog group frame; floor frames only for floor items and only floor frames for floors. */
export function spriteAllowedFor(item: Pick<LibraryItem, "kind">, frameKey: string): boolean {
  if (!isFrameKey(frameKey)) return false;
  const e = REGISTRY[frameKey]!;
  return ALLOWED_GROUPS.has(e.group) && (e.layer === "floor") === (item.kind === "floor");
}

/** The frame fits the item's size for that direction (a smaller one draws bottom-left aligned, OQ-53). */
export function spriteFits(frameKey: string, dir: Direction, w: number, h: number): boolean {
  const [fw, fh] = frameTiles(frameKey);
  const [iw, ih] = sizeFor(dir, w, h);
  return fw <= iw && fh <= ih;
}

/**
 * D66 7: a custom image is 32 px per tile of the item's size for that direction in width, and 32 px per tile up to
 * 32 px taller (upward overhang) in height. Floors are exactly 32 x 32.
 */
export function mapItemImageFits(
  item: Pick<LibraryItem, "kind">,
  dir: Direction,
  w: number,
  h: number,
  px: { width: number; height: number },
): boolean {
  const { tilePx, overhangPx } = MAP_ITEM_LIMITS;
  if (item.kind === "floor") return px.width === tilePx && px.height === tilePx;
  const [tw, th] = sizeFor(dir, w, h);
  return (
    px.width === tilePx * tw && px.height >= tilePx * th && px.height <= tilePx * th + overhangPx
  );
}
