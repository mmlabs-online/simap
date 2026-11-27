// Append-only: stored pixel looks (SIM-047) are indices into these ramps; widening also needs a migration that
// replaces `members_pixel_look_check`.
export const SKIN_RAMP = ["#f6d0b1", "#e8b48f", "#c98e66", "#8d5a3b"] as const;
export const HAIR_RAMP = [
  "#2b2118",
  "#5a3a22",
  "#b07a3a",
  "#1f2a44",
  "#a33b3b",
  "#3b2b4a",
] as const;
export const SHIRT_RAMP = [
  "#e05d5d",
  "#3a7bd5",
  "#2fa36b",
  "#8e5bd6",
  "#f0a03c",
  "#3fb5b0",
  "#5a6b8c",
] as const;

/** FNV-1a 32-bit over the UTF-8 bytes of `input`. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(input)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export type AvatarLook = {
  skin: string;
  hair: string;
  shirt: string;
  style: 1 | 2 | 3;
};

/** Stable look for one Identity `sub`; each part uses its own salt so the picks are independent. */
export function avatarFor(sub: string): AvatarLook {
  return {
    skin: SKIN_RAMP[fnv1a(`${sub}:skin`) % SKIN_RAMP.length],
    hair: HAIR_RAMP[fnv1a(`${sub}:hair`) % HAIR_RAMP.length],
    shirt: SHIRT_RAMP[fnv1a(`${sub}:shirt`) % SHIRT_RAMP.length],
    style: ((fnv1a(`${sub}:style`) % 3) + 1) as 1 | 2 | 3,
  };
}

export type AvatarView = "front" | "back";

/** Back view when the chair frame faces north (the person sits behind the desk's near side), else front. */
export function avatarView(chairKey: string): AvatarView {
  return chairKey.endsWith(".n") ? "back" : "front";
}

/** Frames to draw, bottom to top: body, shirt, hair. */
export function avatarFrames(look: AvatarLook, view: AvatarView): { key: string; tint: string }[] {
  return [
    { key: `avatar.body.${view}`, tint: look.skin },
    { key: `avatar.shirt.${view}`, tint: look.shirt },
    { key: `avatar.hair.${look.style}.${view}`, tint: look.hair },
  ];
}

export const WALK_DIRS = ["n", "e", "s", "w"] as const;
export type WalkDir = (typeof WALK_DIRS)[number];
export const WALK_STEPS = 2;
export const HAIR_STYLES = [1, 2, 3] as const;

export type WalkPose = { dir: WalkDir; step: number };

/** Direction of travel of one path segment (screen y grows down); a zero-length segment faces the viewer. */
export function walkDir(a: { x: number; y: number }, b: { x: number; y: number }): WalkDir {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return "s";
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? "n" : "s";
  return dx > 0 ? "e" : "w";
}

/** Walking frames to draw, bottom to top (same order and tints as `avatarFrames`). */
export function avatarWalkFrames(
  look: AvatarLook,
  pose: WalkPose,
): { key: string; tint: string }[] {
  const suffix = `walk.${pose.dir}.${pose.step}`;
  return [
    { key: `avatar.body.${suffix}`, tint: look.skin },
    { key: `avatar.shirt.${suffix}`, tint: look.shirt },
    { key: `avatar.hair.${look.style}.${suffix}`, tint: look.hair },
  ];
}

/** Every walking frame key (5 layers x 4 directions x 2 steps), sorted. */
export function walkFrameKeys(): string[] {
  const keys: string[] = [];
  for (const dir of WALK_DIRS) {
    for (let step = 0; step < WALK_STEPS; step++) {
      keys.push(`avatar.body.walk.${dir}.${step}`, `avatar.shirt.walk.${dir}.${step}`);
      for (const style of HAIR_STYLES) keys.push(`avatar.hair.${style}.walk.${dir}.${step}`);
    }
  }
  return keys.sort();
}
