export const DEVICE_LIMITS = { list: 1000, name: 120, type: 60, inventoryNumber: 60 } as const;

export type DeviceCreateValue = {
  name: string;
  type: string;
  inventoryNumber: string;
  mac: string | null;
};

export type DevicePatchValue = Partial<{
  name: string;
  type: string;
  inventoryNumber: string;
  mac: string | null;
}>;

export type DeviceRole = "primary" | "secondary";

export type PlacementFilter = "all" | "placed" | "inventory" | "unowned";

export type DevicePlacementDto = {
  seatId: string;
  seatCode: string;
  roomId: string;
  roomCode: string;
  role: DeviceRole;
};

export type DeviceDto = {
  id: string;
  name: string;
  type: string;
  inventoryNumber: string;
  mac: string | null;
  /** Null when the device is in the org inventory (D63). */
  owner: { id: string; displayName: string } | null;
  /** Null when the device is in inventory. */
  placement: DevicePlacementDto | null;
  /** True when the caller owns the device (computed on the server from the token's sub). */
  mine: boolean;
  /** Owner or Admin (D19); an unowned device is edited by an Admin only. */
  canEdit: boolean;
  /** Owner or Manager+ (D19); false for an unowned device (invariant 5). */
  canPlace: boolean;
  /** Admin and the device is in the org inventory (DEV-01). A pending handoff is checked by the server only. */
  canDelete: boolean;
};

export type DeviceListResponse = { items: DeviceDto[]; truncated: boolean };
