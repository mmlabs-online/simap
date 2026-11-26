import { isPixelLook, PIXEL_LOOK_KEYS, type PixelLook } from "@/lib/sprites/pixel-look";
import type { Validated } from "./room";

/** The body of PUT /api/me/pixel-look: exactly one preset per layer; `field` names the first bad key. */
export function validatePixelLook(body: unknown): Validated<PixelLook> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, field: "body" };
  }
  if (isPixelLook(body)) {
    const { skin, hair, style, shirt } = body;
    return { ok: true, value: { skin, hair, style, shirt } };
  }
  const o = body as Record<string, unknown>;
  for (const k of PIXEL_LOOK_KEYS) {
    if (!isPixelLook({ ...DEFAULT, [k]: o[k] })) return { ok: false, field: k };
  }
  const extra = Object.keys(o).find((k) => !(PIXEL_LOOK_KEYS as readonly string[]).includes(k));
  return { ok: false, field: extra ?? "body" };
}

const DEFAULT: PixelLook = { skin: 0, hair: 0, style: 1, shirt: 0 };
