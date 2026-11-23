export const DEVICE_LIMITS = { list: 1000 } as const;

export type DeviceRole = "primary" | "secondary";

export type PlacementFilter = "all" | "placed" | "inventory";

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
  owner: { id: string; displayName: string };
  /** Null when the device is in inventory. */
  placement: DevicePlacementDto | null;
  /** True when the caller owns the device (computed on the server from the token's sub). */
  mine: boolean;
  /** Owner or Admin (D19). */
  canEdit: boolean;
  /** Owner or Manager+ (D19). */
  canPlace: boolean;
};

export type DeviceListResponse = { items: DeviceDto[]; truncated: boolean };
