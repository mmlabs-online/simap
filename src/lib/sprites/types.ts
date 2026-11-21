/** Draw layers, bottom to top (style guide section 8). */
export type Layer = "floor" | "wall" | "shadow" | "furniture" | "avatar" | "overlay";

export type Direction = "n" | "e" | "s" | "w";

export type SpriteSource = "export" | "map" | "placeholder";

/** One frame key in `keys.json`. `tiles` is `[w, d]` of the footprint; null means a sub-tile prop. */
export type RegistryEntry = {
  group: string;
  dir: Direction | null;
  layer: Layer;
  tiles: [number, number] | null;
  blocks: boolean;
  shadow: boolean;
};

export type SpriteFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Offset in px from the footprint's top-left tile corner to the sprite's top-left; may be negative. */
  anchor: [number, number];
  tiles: [number, number];
  blocks: boolean;
};

export type ManifestMeta = {
  generator: string;
  version: string;
  sources: Record<string, SpriteSource>;
};

export type SpriteManifest = {
  tile: 32;
  frames: Record<string, SpriteFrame>;
  layers: Layer[];
  meta?: ManifestMeta;
};
