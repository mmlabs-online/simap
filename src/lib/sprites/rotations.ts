import type { Rotation } from "./layout";
import type { Direction } from "./types";

/** SIM-049: these directional items face north or south only (rotation 0 or 180). */
const NS_ONLY: ReadonlySet<string> = new Set(["clock.wall", "screen.projector"]);

const ALL_ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];
const ALL_DIRS: readonly Direction[] = ["n", "e", "s", "w"];

/** Rotations a directional base key may take. */
export const allowedRotations = (base: string): readonly Rotation[] =>
  NS_ONLY.has(base) ? [0, 180] : ALL_ROTATIONS;

/** Art directions a directional base key has. */
export const allowedDirs = (base: string): readonly Direction[] =>
  NS_ONLY.has(base) ? ["n", "s"] : ALL_DIRS;

export const rotationAllowed = (base: string, rotation: number): boolean =>
  (allowedRotations(base) as readonly number[]).includes(rotation);

/** The next rotation in the editor's turn order. */
export function nextRotation(base: string, rotation: Rotation): Rotation {
  if (NS_ONLY.has(base)) return rotation === 0 ? 180 : 0;
  return ((rotation + 90) % 360) as Rotation;
}
