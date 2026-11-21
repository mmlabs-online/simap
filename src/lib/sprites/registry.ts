import keys from "./keys.json";
import type { Layer, RegistryEntry } from "./types";

export const REGISTRY: Readonly<Record<string, RegistryEntry>> = keys as unknown as Record<
  string,
  RegistryEntry
>;

/** Every frame key the manifest must contain, sorted. */
export const FRAME_KEYS: readonly string[] = Object.keys(REGISTRY).sort();

/** Draw layers, bottom to top. */
export const LAYERS: readonly Layer[] = [
  "floor",
  "wall",
  "shadow",
  "furniture",
  "avatar",
  "overlay",
];

export function isFrameKey(key: string): boolean {
  return Object.hasOwn(REGISTRY, key);
}
