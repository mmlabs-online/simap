export const SEAT_LIMITS = {
  addMax: 50,
  list: 500,
  listDevices: 20,
  detailDevices: 200,
  reason: 200,
} as const;

export type SeatStatus = "empty" | "occupied";

export type SeatDeviceDto = {
  id: string;
  name: string;
  type: string;
  inventoryNumber: string;
  role: "primary" | "secondary";
  owner: { id: string; displayName: string } | null;
};

export type SeatDto = {
  id: string;
  code: string;
  seq: number;
  roomId: string;
  roomCode: string;
  status: SeatStatus;
  cannotSeat: boolean;
  cannotSeatReason: string | null;
  occupant: { id: string; displayName: string } | null;
  /** True when the caller is the occupant (computed on the server from the token's sub). */
  mine: boolean;
  group: { id: string; name: string; color: string } | null;
  project: { id: string; code: string; name: string } | null;
  deviceCount: number;
  devices: SeatDeviceDto[];
};

export type RoomSeatsResponse = {
  room: { id: string; code: string; name: string };
  items: SeatDto[];
  truncated: boolean;
};
