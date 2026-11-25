import type { DeviceKind } from "@/lib/device-types/types";
import { DEVICE_SPRITE } from "@/lib/sprites/device-slots";
import {
  DEVICE_SPRITE_FAMILIES,
  deviceFrameKey,
  deviceSpriteAllowed,
} from "@/lib/sprites/device-sprites";

export type SpriteOption = {
  /** The stored value; null = the slot's built-in sprite. */
  value: string | null;
  /** Atlas frame shown as the thumbnail (desk facing south). */
  preview: string;
  checked: boolean;
};

export type SpriteFieldView = {
  options: SpriteOption[];
  /** A stored pick the registry no longer knows; no option is checked then. */
  unavailable: string | null;
  /** An uploaded image is drawn instead of the pick. */
  hiddenByImage: boolean;
};

export function spriteFieldView(args: {
  value: string | null;
  slot: DeviceKind;
  imageShown: boolean;
}): SpriteFieldView {
  const { value, slot, imageShown } = args;
  const unavailable = value !== null && !deviceSpriteAllowed(value) ? value : null;
  const builtIn = deviceFrameKey(DEVICE_SPRITE[slot], "s") ?? DEVICE_SPRITE[slot];
  return {
    options: [
      { value: null, preview: builtIn, checked: value === null },
      ...DEVICE_SPRITE_FAMILIES.map((f) => ({
        value: f,
        preview: deviceFrameKey(f, "s") ?? f,
        checked: value === f,
      })),
    ],
    unavailable,
    hiddenByImage: imageShown && value !== null,
  };
}
