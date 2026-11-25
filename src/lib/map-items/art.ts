import { REGISTRY, isFrameKey } from "@/lib/sprites/registry";
import type { Direction } from "@/lib/sprites/types";
import { LIBRARY_ITEMS, type LibraryItem } from "./library";

/** Frame groups a catalog item may wear: the groups of the library items (never avatar, device or state frames). */
const ALLOWED_GROUPS: ReadonlySet<string> = new Set(LIBRARY_ITEMS.map((i) => i.group));

/** The item's tiles for a direction: rotation-0 size, swapped for e/w (D66.7). */
export const sizeFor = (dir: Direction, w: number, h: number): [number, number] =>
  dir === "e" || dir === "w" ? [h, w] : [w, h];

/** Tiles of a package frame; frames without a footprint are 1 x 1. */
export const frameTiles = (frameKey: string): [number, number] =>
  REGISTRY[frameKey]?.tiles ?? [1, 1];

/** A non-directional item uses `s` only. */
export const artDirAllowed = (item: Pick<LibraryItem, "directional">, dir: Direction): boolean =>
  item.directional || dir === "s";

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
