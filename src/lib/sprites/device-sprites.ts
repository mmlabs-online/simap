import { isFrameKey, REGISTRY } from "./registry";
import type { Direction } from "./types";

/** Sprite families a device type may pick (D66): the 1 x 1 `device` frames, directional ones by their base key. */
export const DEVICE_SPRITE_FAMILIES: readonly string[] = [
  ...new Set(
    Object.entries(REGISTRY)
      .filter(
        ([, e]) =>
          e.group === "device" && (e.tiles === null || (e.tiles[0] === 1 && e.tiles[1] === 1)),
      )
      .map(([key, e]) => (e.dir ? key.slice(0, -(e.dir.length + 1)) : key)),
  ),
].sort();

export const deviceSpriteAllowed = (family: string): boolean =>
  DEVICE_SPRITE_FAMILIES.includes(family);

/** The frame drawn for a family on a desk facing `dir`; null when the family is not known (draw the slot sprite). */
export function deviceFrameKey(family: string, dir: Direction): string | null {
  if (!deviceSpriteAllowed(family)) return null;
  if (isFrameKey(`${family}.${dir}`)) return `${family}.${dir}`;
  return isFrameKey(family) ? family : null;
}
