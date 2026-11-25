import type { DeviceKind } from "@/lib/sprites/device-slots";

export type { DeviceKind };

/** D61: name is at most as long as `devices.type` so every catalog name is a valid device type. */
export const DEVICE_TYPE_LIMITS = { name: 60, perOrg: 100, bodyBytes: 1024 } as const;

/** The desk slots (SIM-035); kept equal to `DEVICE_SPRITE` by a test. */
export const DEVICE_KINDS: readonly DeviceKind[] = ["monitor", "laptop", "pc", "phone", "other"];

/** D37 types every org starts with; kept equal to the migration by a test. */
export const SEED_DEVICE_TYPES: readonly { name: string; slot: DeviceKind }[] = [
  { name: "PC", slot: "pc" },
  { name: "Laptop", slot: "laptop" },
  { name: "Monitor", slot: "monitor" },
  { name: "IP phone", slot: "phone" },
  { name: "Other", slot: "other" },
];

export type DeviceTypeDto = {
  id: string;
  name: string;
  slot: DeviceKind;
  hasImage: boolean;
  imageVersion: number;
  /** Picked package sprite family (D66); null = the slot's built-in sprite. */
  sprite: string | null;
};

export type DeviceTypeListResponse = { items: DeviceTypeDto[] };

export type DeviceTypeCreateValue = { name: string; slot: DeviceKind; sprite?: string | null };

export type DeviceTypePatchValue = Partial<DeviceTypeCreateValue>;
