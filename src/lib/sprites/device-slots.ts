import { deviceFrameKey } from "./device-sprites";
import type { SeatDevice, SeatDeviceType } from "./layout";
import type { Direction } from "./types";

/** D61/D62: how a seat's devices are drawn on its desk. Code-defined for now; SIM-036 makes the table data. */
export type DeviceKind = "monitor" | "laptop" | "pc" | "phone" | "other";

/** A slot in the desk's own frame: tile index `u` from the occupant's left, `du` px to their right, `dv` px to the desk's back. */
export type Slot = { u: number; du: number; dv: number; under: boolean };

/** Base sprite key per kind; monitor and laptop are directional and follow the desk. */
export const DEVICE_SPRITE: Record<DeviceKind, string> = {
  monitor: "device.monitor",
  laptop: "device.laptop",
  pc: "device.pc",
  phone: "device.phone",
  other: "device.other",
};

const DIRECTIONAL: Record<DeviceKind, boolean> = {
  monitor: true,
  laptop: true,
  pc: false,
  phone: false,
  other: false,
};

/** Starting values, tuned by eye in /dev/roommap. Order within a kind is the API order (primary first). */
export const SLOTS: Record<DeviceKind, Slot[]> = {
  monitor: [
    { u: 1, du: -4, dv: 8, under: false },
    { u: 0, du: 4, dv: 8, under: false },
  ],
  laptop: [
    { u: 0, du: 6, dv: 0, under: false },
    { u: 1, du: -6, dv: 0, under: false },
  ],
  pc: [
    { u: 1, du: 6, dv: -6, under: true },
    { u: 0, du: -6, dv: -6, under: true },
  ],
  phone: [
    { u: 0, du: -8, dv: -2, under: false },
    { u: 1, du: 8, dv: -2, under: false },
  ],
  other: [
    { u: 0, du: -2, dv: 4, under: false },
    { u: 1, du: 2, dv: -4, under: false },
  ],
};

/** A device past the kind's last slot is shifted by this many screen px per extra device. */
export const STACK: [number, number] = [3, -3];
export const MAX_PER_KIND = 4;

const KINDS: Record<string, DeviceKind> = {
  pc: "pc",
  laptop: "laptop",
  monitor: "monitor",
  "ip phone": "phone",
};

/** D37 type names, trimmed, lowercased and with runs of spaces collapsed; anything else is `other`. */
export function deviceKind(type: string): DeviceKind {
  const norm = type.trim().toLowerCase().replace(/\s+/g, " ");
  return Object.hasOwn(KINDS, norm) ? KINDS[norm] : "other";
}

/** What is drawn for a device: the built-in sprite of its kind, the square placeholder, a picked package sprite family (D66), or the catalog image (24-100 px, drawn in the 24 px slot box, D68). */
export type DeviceArt =
  | { type: "sprite" }
  | { type: "placeholder" }
  | { type: "packageSprite"; family: string }
  | { type: "image"; typeId: string; version: number };

/** A device with its slot kind and art resolved. */
export type ResolvedDevice = { kind: DeviceKind; art: DeviceArt };

/** D61: the slot comes from the catalog type, never from the name. `deviceType` undefined (no catalog info) keeps the name-based kind. */
export function resolveDeviceArt(
  device: SeatDevice,
  imageReady: (t: SeatDeviceType) => boolean,
): ResolvedDevice {
  const t = device.deviceType;
  if (t === undefined) return { kind: deviceKind(device.type), art: { type: "sprite" } };
  if (t === null) return { kind: "other", art: { type: "placeholder" } };
  if (!t.hasImage) {
    return {
      kind: t.slot,
      art: t.sprite !== null ? { type: "packageSprite", family: t.sprite } : { type: "sprite" },
    };
  }
  if (!imageReady(t)) return { kind: t.slot, art: { type: "placeholder" } };
  return { kind: t.slot, art: { type: "image", typeId: t.id, version: t.imageVersion } };
}

export type DevicePlacement = {
  kind: DeviceKind;
  art: DeviceArt;
  /** Frame key (directional kinds carry the desk's direction). */
  key: string;
  /** Tile the frame is anchored on. */
  x: number;
  y: number;
  /** Extra pixel offset in screen space. */
  offset: [number, number];
  under: boolean;
};

// Screen-space unit vectors toward the occupant's right and toward the desk's back, per desk direction.
const AXES: Record<Direction, { right: [number, number]; back: [number, number] }> = {
  s: { right: [1, 0], back: [0, -1] },
  n: { right: [-1, 0], back: [0, 1] },
  e: { right: [0, -1], back: [-1, 0] },
  w: { right: [0, 1], back: [1, 0] },
};

/** Where each device of a desk is drawn, in the given order (primary first). Extra devices past the cap are dropped. */
export function placeDevices(
  desk: { x: number; y: number },
  footprint: readonly [number, number],
  dir: Direction,
  types: readonly (string | ResolvedDevice)[],
): DevicePlacement[] {
  const long = Math.max(footprint[0], footprint[1]);
  const { right, back } = AXES[dir];
  const seen: Record<DeviceKind, number> = { monitor: 0, laptop: 0, pc: 0, phone: 0, other: 0 };
  const out: DevicePlacement[] = [];
  for (const type of types) {
    const { kind, art }: ResolvedDevice =
      typeof type === "string" ? { kind: deviceKind(type), art: { type: "sprite" } } : type;
    const n = seen[kind]++;
    if (n >= MAX_PER_KIND) continue;
    const slots = SLOTS[kind];
    const slot = slots[Math.min(n, slots.length - 1)];
    const extra = Math.max(0, n - (slots.length - 1));
    const u = Math.min(slot.u, long - 1);
    const x = dir === "s" ? desk.x + u : dir === "n" ? desk.x + long - 1 - u : desk.x;
    const y = dir === "e" ? desk.y + long - 1 - u : dir === "w" ? desk.y + u : desk.y;
    out.push({
      kind,
      art,
      key:
        art.type === "placeholder"
          ? DEVICE_SPRITE.other
          : ((art.type === "packageSprite" ? deviceFrameKey(art.family, dir) : null) ??
            (DIRECTIONAL[kind] ? `${DEVICE_SPRITE[kind]}.${dir}` : DEVICE_SPRITE[kind])),
      x,
      y,
      offset: [
        slot.du * right[0] + slot.dv * back[0] + extra * STACK[0],
        slot.du * right[1] + slot.dv * back[1] + extra * STACK[1],
      ],
      under: slot.under,
    });
  }
  return out;
}
