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
