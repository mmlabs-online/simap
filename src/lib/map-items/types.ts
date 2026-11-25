import type { Direction } from "@/lib/sprites/types";

export const MAP_ITEM_DIRS = ["n", "e", "s", "w"] as const;

export const MAP_ITEM_LIMITS = {
  name: 60,
  group: 40,
  sizeMin: 1,
  sizeMax: 4,
  list: 200,
  bodyBytes: 1024,
} as const;

/** Derived from the library, never stored. "Add items" palette = kind seat|fixture and !hidden. */
export type MapItemKind = "seat" | "fixture" | "floor" | "chair";

export type MapItemArtDto = { sprite: string | null; hasImage: boolean; imageVersion: number };

export type MapItemDto = {
  /** Stable id (= the layout placement `sprite`); there is no uuid. */
  builtinKey: string;
  name: string;
  group: string;
  /** Tiles at rotation 0; 90/270 swap them (D66.7). */
  w: number;
  h: number;
  /** True only ever reaches Admins (D67 2). */
  hidden: boolean;
  kind: MapItemKind;
  directional: boolean;
  /** Seat, floor and chair sizes are fixed (D66.7). */
  fixedSize: boolean;
  /** Always n/e/s/w; a non-directional item uses `s` only. */
  art: Record<Direction, MapItemArtDto>;
};

/** Sorted by name (case-insensitive), then builtinKey (D67 1). */
export type MapItemListResponse = { items: MapItemDto[] };

/** A non-empty partial edit of an item (SIM-039.2). */
export type MapItemPatchValue = {
  name?: string;
  group?: string;
  hidden?: boolean;
  w?: number;
  h?: number;
};

/** `sprite: null` = back to the library sprite. */
export type MapItemArtValue = { sprite: string | null };
