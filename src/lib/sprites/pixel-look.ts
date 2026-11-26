import { avatarFor, fnv1a, HAIR_RAMP, SHIRT_RAMP, SKIN_RAMP, type AvatarLook } from "./avatar";

/** A member's chosen pixel character (POR-06): one preset per layer, as indices into the avatar ramps. */
export type PixelLook = { skin: number; hair: number; style: 1 | 2 | 3; shirt: number };

export const PIXEL_LOOK_KEYS = ["skin", "hair", "style", "shirt"] as const;

const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;

/** Exactly the four keys, each an integer inside its ramp. */
export function isPixelLook(v: unknown): v is PixelLook {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o);
  return (
    keys.length === PIXEL_LOOK_KEYS.length &&
    PIXEL_LOOK_KEYS.every((k) => keys.includes(k)) &&
    inRange(o.skin, 0, SKIN_RAMP.length - 1) &&
    inRange(o.hair, 0, HAIR_RAMP.length - 1) &&
    inRange(o.style, 1, 3) &&
    inRange(o.shirt, 0, SHIRT_RAMP.length - 1)
  );
}

/** Tolerant read of a stored or received value: a valid look, else null. */
export function parsePixelLook(v: unknown): PixelLook | null {
  return isPixelLook(v) ? { skin: v.skin, hair: v.hair, style: v.style, shirt: v.shirt } : null;
}

export function lookFromChoice(c: PixelLook): AvatarLook {
  return {
    skin: SKIN_RAMP[c.skin]!,
    hair: HAIR_RAMP[c.hair]!,
    shirt: SHIRT_RAMP[c.shirt]!,
    style: c.style,
  };
}

/** The chosen look when valid, else the look derived from `seed` (existing members change nothing). */
export function resolveLook(c: unknown, seed: string): AvatarLook {
  const look = parsePixelLook(c);
  return look ? lookFromChoice(look) : avatarFor(seed);
}

/** The indices of `avatarFor(seed)` (same salts), for a picker's Reset and preselection. */
export function derivedChoice(seed: string): PixelLook {
  return {
    skin: fnv1a(`${seed}:skin`) % SKIN_RAMP.length,
    hair: fnv1a(`${seed}:hair`) % HAIR_RAMP.length,
    style: ((fnv1a(`${seed}:style`) % 3) + 1) as 1 | 2 | 3,
    shirt: fnv1a(`${seed}:shirt`) % SHIRT_RAMP.length,
  };
}
